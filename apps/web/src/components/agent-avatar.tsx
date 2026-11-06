import type { PresenceState } from "@vc/core/client";
import { cn } from "@/lib/utils";
import { PRESENCE_COLORS } from "./status";

function hash(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const SKIN = ["#f2d3b1", "#e0b48f", "#c68a5e", "#a8693f", "#7a4a2a", "#5a3520"];
const HAIR = ["#1d1b1a", "#3b2a20", "#6b4a2b", "#b07a3c", "#d9c08a", "#8a8f99", "#2b3a67"];
const SHIRT = ["#3d7bff", "#22d3ee", "#a78bfa", "#14b8a6", "#f472b6", "#64748b"];

/**
 * Stylized character bust generated deterministically from the agent's seed.
 * Uses avatarUrl when the owner configured an external image.
 */
export function AgentAvatar({
  seed,
  url,
  name,
  size = 40,
  presence,
  className,
}: {
  seed: string;
  url?: string | null;
  name: string;
  size?: number;
  presence?: PresenceState | null;
  className?: string;
}) {
  const h = hash(seed);
  const skin = SKIN[h % SKIN.length]!;
  const hair = HAIR[(h >>> 3) % HAIR.length]!;
  const shirt = SHIRT[(h >>> 6) % SHIRT.length]!;
  const hairStyle = (h >>> 9) % 4;
  const glasses = ((h >>> 12) & 3) === 0;
  const headset = ((h >>> 14) & 3) === 1;

  return (
    <span className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} width={size} height={size} className="size-full rounded-xl object-cover ring-1 ring-border-strong" />
      ) : (
        <svg viewBox="0 0 64 64" role="img" aria-label={name} className="size-full rounded-xl ring-1 ring-border-strong">
          <defs>
            <linearGradient id={`bg-${seed}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#1b2433" />
              <stop offset="1" stopColor="#0f141c" />
            </linearGradient>
          </defs>
          <rect width="64" height="64" fill={`url(#bg-${seed})`} />
          {/* torso */}
          <path d="M10 64c0-13 10-20 22-20s22 7 22 20z" fill={shirt} />
          <path d="M26 44l6 8 6-8" fill="none" stroke="#0b0e13" strokeOpacity=".35" strokeWidth="2" />
          {/* neck + head */}
          <rect x="27" y="36" width="10" height="9" rx="3" fill={skin} />
          <ellipse cx="32" cy="27" rx="11" ry="12.5" fill={skin} />
          {/* hair */}
          {hairStyle === 0 && <path d="M21 26c0-9 5-14 11-14s11 5 11 14c-3-5-7-7-11-7s-8 2-11 7z" fill={hair} />}
          {hairStyle === 1 && <path d="M20 30c-1-12 5-18 12-18s13 6 12 18c-1-3-2-7-4-9-5 3-12 3-17 0-2 2-3 6-3 9z" fill={hair} />}
          {hairStyle === 2 && (
            <path d="M19 33c-2-14 5-21 13-21s15 7 13 21l-2 8c0-8-1-15-3-18-5 2-11 2-16 0-2 3-3 10-3 18z" fill={hair} />
          )}
          {hairStyle === 3 && <path d="M22 22c2-6 6-9 10-9s8 3 10 9c-6-2-14-2-20 0z" fill={hair} />}
          {/* eyes */}
          <circle cx="27.5" cy="28" r="1.4" fill="#141821" />
          <circle cx="36.5" cy="28" r="1.4" fill="#141821" />
          <path d="M29 33.5q3 2 6 0" stroke="#141821" strokeOpacity=".6" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          {glasses && (
            <g fill="none" stroke="#cfd8e6" strokeWidth="1.2">
              <rect x="23.5" y="25" width="7.5" height="6" rx="2" />
              <rect x="33" y="25" width="7.5" height="6" rx="2" />
              <path d="M31 28h2" />
            </g>
          )}
          {headset && (
            <g fill="none" stroke="#3d7bff" strokeWidth="1.8">
              <path d="M20 28c0-8 5-13 12-13s12 5 12 13" />
              <path d="M21 31q2 6 8 6" />
            </g>
          )}
        </svg>
      )}
      {presence && (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2 ring-background",
            presence === "working" && "animate-pulse-ring",
          )}
          style={{ backgroundColor: PRESENCE_COLORS[presence] }}
          title={presence}
        />
      )}
    </span>
  );
}
