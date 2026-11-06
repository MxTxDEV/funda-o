import * as THREE from "three";

/**
 * Procedural PBR-style textures generated at runtime (no third-party image assets).
 * Each texture is created once and cached. Sizes are small (256–512 px) to keep GPU memory low.
 */
const cache = new Map<string, THREE.Texture>();

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvasTexture(key: string, size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void, opts: { repeat?: [number, number]; srgb?: boolean } = {}) {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  if (opts.repeat) tex.repeat.set(...opts.repeat);
  if (opts.srgb !== false) tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}

function noise(ctx: CanvasRenderingContext2D, size: number, seed: number, alpha: number, scale = 1) {
  const r = rng(seed);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * 255 * alpha * scale;
    img.data[i] = Math.max(0, Math.min(255, img.data[i]! + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1]! + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2]! + n));
  }
  ctx.putImageData(img, 0, 0);
}

/** Wood planks (floors) or continuous grain (furniture tops). */
export function woodTexture(tone: "oak" | "walnut" | "ash" = "oak", planks = true) {
  const base = { oak: ["#8a6a4a", "#a07b55"], walnut: ["#4a3324", "#5d4130"], ash: ["#b9a58c", "#cbb89f"] }[tone];
  return canvasTexture(`wood:${tone}:${planks}`, 512, (ctx, s) => {
    const r = rng(tone.length * 97 + (planks ? 1 : 2));
    ctx.fillStyle = base[0]!;
    ctx.fillRect(0, 0, s, s);
    const rows = planks ? 8 : 1;
    const h = s / rows;
    for (let row = 0; row < rows; row++) {
      const shade = r() * 0.25 - 0.12;
      ctx.fillStyle = shade > 0 ? base[1]! : base[0]!;
      ctx.globalAlpha = 0.55 + Math.abs(shade);
      ctx.fillRect(0, row * h, s, h);
      ctx.globalAlpha = 1;
      // grain lines
      for (let g = 0; g < 26; g++) {
        const y = row * h + r() * h;
        ctx.strokeStyle = `rgba(30,18,10,${0.05 + r() * 0.12})`;
        ctx.lineWidth = 0.6 + r() * 1.4;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= s; x += 32) ctx.lineTo(x, y + Math.sin(x / (40 + r() * 60) + g) * (1.5 + r() * 2));
        ctx.stroke();
      }
      if (planks) {
        ctx.fillStyle = "rgba(10,6,3,0.55)";
        ctx.fillRect(0, row * h, s, 1.5);
        const joint = r() * s;
        ctx.fillRect(joint, row * h, 1.5, h);
      }
    }
    noise(ctx, s, 11, 0.06);
  });
}

export function concreteTexture() {
  return canvasTexture("concrete", 512, (ctx, s) => {
    ctx.fillStyle = "#5d6168";
    ctx.fillRect(0, 0, s, s);
    const r = rng(7);
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = `rgba(${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},0.025)`;
      const rad = 10 + r() * 60;
      ctx.beginPath();
      ctx.arc(r() * s, r() * s, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    noise(ctx, s, 5, 0.12);
    // expansion joints
    ctx.fillStyle = "rgba(20,22,26,0.5)";
    ctx.fillRect(0, 0, s, 2);
    ctx.fillRect(0, 0, 2, s);
  });
}

export function carpetTexture(color = "#2a3142") {
  return canvasTexture(`carpet:${color}`, 256, (ctx, s) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, s, s);
    noise(ctx, s, 3, 0.22);
    ctx.strokeStyle = "rgba(255,255,255,0.035)";
    for (let i = 0; i < s; i += 16) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, s);
      ctx.stroke();
    }
  });
}

export function fabricTexture(color: string) {
  return canvasTexture(`fabric:${color}`, 128, (ctx, s) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 2) {
      ctx.fillStyle = y % 4 === 0 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";
      ctx.fillRect(0, y, s, 1);
    }
    for (let x = 0; x < s; x += 2) {
      ctx.fillStyle = x % 4 === 0 ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.05)";
      ctx.fillRect(x, 0, 1, s);
    }
    noise(ctx, s, 9, 0.08);
  });
}

/** Vertical wood slats for acoustic feature walls. */
export function slatTexture(tone = "#6b4f36") {
  return canvasTexture(`slat:${tone}`, 256, (ctx, s) => {
    ctx.fillStyle = "#14171c";
    ctx.fillRect(0, 0, s, s);
    const n = 16;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = tone;
      ctx.globalAlpha = 0.85 + (i % 3) * 0.05;
      ctx.fillRect(i * (s / n) + 2, 0, s / n - 5, s);
    }
    ctx.globalAlpha = 1;
    noise(ctx, s, 13, 0.08);
  });
}

/** Text sign (department names on walls). Uses the system UI font — no font download. */
export function signTexture(text: string, color: string, sub?: string) {
  return canvasTexture(
    `sign:${text}:${color}:${sub ?? ""}`,
    512,
    (ctx, s) => {
      ctx.clearRect(0, 0, s, s);
      ctx.fillStyle = "rgba(0,0,0,0)";
      ctx.fillRect(0, 0, s, s);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#f1f4f8";
      let size = 64;
      ctx.font = `600 ${size}px Inter, ui-sans-serif, system-ui, sans-serif`;
      while (ctx.measureText(text).width > s * 0.92 && size > 24) {
        size -= 4;
        ctx.font = `600 ${size}px Inter, ui-sans-serif, system-ui, sans-serif`;
      }
      ctx.fillText(text, s / 2, s / 2 - (sub ? 22 : 0));
      ctx.fillStyle = color;
      ctx.fillRect(s / 2 - 40, s / 2 + size / 2 + 2 - (sub ? 22 : 0), 80, 5);
      if (sub) {
        ctx.fillStyle = "#9aa6b8";
        ctx.font = `500 26px Inter, ui-sans-serif, system-ui, sans-serif`;
        ctx.fillText(sub.toUpperCase(), s / 2, s / 2 + size / 2 + 40);
      }
    },
    { srgb: true },
  );
}

/** Abstract wall art (decorative, no data). */
export function artTexture(seed: number, palette: string[]) {
  return canvasTexture(`art:${seed}:${palette.join()}`, 256, (ctx, s) => {
    const r = rng(seed);
    ctx.fillStyle = "#e9e5dc";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = palette[Math.floor(r() * palette.length)]!;
      ctx.globalAlpha = 0.75;
      if (r() > 0.5) {
        ctx.beginPath();
        ctx.arc(r() * s, r() * s, 20 + r() * 70, 0, Math.PI * 2);
        ctx.fill();
      } else ctx.fillRect(r() * s, r() * s, 30 + r() * 120, 8 + r() * 40);
    }
    ctx.globalAlpha = 1;
  });
}

/** Screen content: "active" = code/document lines (scrolled in the shader via offset), "idle" = lock screen. */
export function screenTexture(kind: "active" | "idle") {
  return canvasTexture(`screen:${kind}`, 256, (ctx, s) => {
    ctx.fillStyle = kind === "active" ? "#0b1a33" : "#070c16";
    ctx.fillRect(0, 0, s, s);
    if (kind === "active") {
      const r = rng(21);
      for (let y = 8; y < s; y += 10) {
        let x = 10 + Math.floor(r() * 4) * 12;
        const segs = 2 + Math.floor(r() * 4);
        for (let k = 0; k < segs; k++) {
          const w = 12 + r() * 50;
          ctx.fillStyle = ["#5a90ff", "#22d3ee", "#9aa6b8", "#a78bfa"][Math.floor(r() * 4)]!;
          ctx.globalAlpha = 0.75;
          ctx.fillRect(x, y, w, 4);
          x += w + 8;
        }
      }
      ctx.globalAlpha = 1;
    } else {
      const g = ctx.createLinearGradient(0, 0, s, s);
      g.addColorStop(0, "#0d1d3a");
      g.addColorStop(1, "#06080d");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = "rgba(122,162,255,0.6)";
      ctx.beginPath();
      ctx.moveTo(s / 2 - 18, s / 2 - 20);
      ctx.lineTo(s / 2, s / 2 + 12);
      ctx.lineTo(s / 2 + 18, s / 2 - 20);
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(122,162,255,0.6)";
      ctx.stroke();
    }
  });
}

/** Text panel (meeting room / traffic screens). Shows only real or explanatory text. */
export function panelTexture(lines: string[], accent = "#3d7bff") {
  return canvasTexture(`panel:${lines.join("|")}:${accent}`, 512, (ctx, s) => {
    ctx.fillStyle = "#08101f";
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = accent;
    ctx.fillRect(32, 40, 60, 6);
    ctx.textAlign = "left";
    ctx.fillStyle = "#e6ebf2";
    ctx.font = "600 40px Inter, ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(lines[0] ?? "", 32, 110);
    ctx.fillStyle = "#8792a5";
    ctx.font = "400 26px Inter, ui-sans-serif, system-ui, sans-serif";
    lines.slice(1).forEach((l, i) => ctx.fillText(l, 32, 170 + i * 40));
  });
}
