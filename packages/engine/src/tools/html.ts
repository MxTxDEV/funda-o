const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

export function decodeEntities(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+[0-9]*);/gi, (m, e: string) => {
    const k = e.toLowerCase();
    if (k.startsWith("#x")) return String.fromCodePoint(parseInt(k.slice(2), 16) || 32);
    if (k.startsWith("#")) return String.fromCodePoint(Number(k.slice(1)) || 32);
    return ENTITIES[k] ?? m;
  });
}

const clean = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** Readable text and key metadata from an HTML page (no scripts, styles or markup). */
export function htmlToText(html: string) {
  const title = clean(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "");
  const description =
    /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i.exec(html)?.[1] ??
    /<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i.exec(html)?.[1] ??
    "";
  const headings = [...html.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => clean(m[2] ?? "")).filter(Boolean).slice(0, 30);
  const body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const text = decodeEntities(body)
    .split("\n")
    .map((l) => l.replace(/[ \t\r\f\v]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  return { title, description: decodeEntities(description).trim(), headings, text };
}
