import { isIP } from "node:net";
import { ToolError, type LookupFn } from "./types";

function v4ToInt(ip: string) {
  return ip.split(".").reduce((acc, p) => (acc << 8) + Number(p), 0) >>> 0;
}
const V4_BLOCKED: [string, number][] = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];

export function isPublicIPv4(ip: string) {
  const n = v4ToInt(ip);
  return !V4_BLOCKED.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (n & mask) === (v4ToInt(base) & mask);
  });
}

export function isPublicIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isPublicIPv4(ip);
  if (kind !== 6) return false;
  const a = ip.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(a);
  if (mapped) return isPublicIPv4(mapped[1]!);
  if (a === "::" || a === "::1") return false;
  if (/^f[cd]/.test(a)) return false; // fc00::/7 unique local
  if (/^fe[89ab]/.test(a)) return false; // fe80::/10 link local
  if (a.startsWith("ff")) return false; // multicast
  if (a.startsWith("2001:db8") || a.startsWith("64:ff9b") || a.startsWith("::ffff")) return false;
  return true;
}

const BLOCKED_HOST = /(^localhost$|\.localhost$|\.local$|\.internal$|\.lan$|\.home$|\.corp$)/i;

/**
 * Validates that a URL points to the public internet: http(s) only, default ports, no credentials,
 * and every resolved address public. Prevents server-side request forgery against internal services.
 */
export async function assertPublicUrl(raw: string, lookup: LookupFn): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ToolError("URL inválida.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new ToolError("Somente URLs http(s) são permitidas.");
  if (url.username || url.password) throw new ToolError("URLs com credenciais não são permitidas.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new ToolError("Somente as portas padrão (80/443) são permitidas.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (BLOCKED_HOST.test(host)) throw new ToolError("Endereço interno bloqueado.");
  if (isIP(host)) {
    if (!isPublicIp(host)) throw new ToolError("Endereço interno bloqueado.");
    return url;
  }
  let addresses: { address: string }[];
  try {
    addresses = await lookup(host);
  } catch {
    throw new ToolError(`Não foi possível resolver o domínio ${host}.`);
  }
  if (addresses.length === 0 || addresses.some((a) => !isPublicIp(a.address))) throw new ToolError("Endereço interno bloqueado.");
  return url;
}
