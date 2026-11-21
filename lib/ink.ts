// Team and author colors are picked for swatches; as small text on the cards they can
// fall under WCAG AA. readableInk keeps the hue and mixes in white until it reaches 4.5:1.

const SURFACE_2 = "#1b2440"; // lightest card surface (globals.css --surface-2), the worst case

function rgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: string, b: string): number {
  const la = luminance(rgb(a) ?? [0, 0, 0]);
  const lb = luminance(rgb(b) ?? [0, 0, 0]);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const cache = new Map<string, string>();

/** The color itself if it already reads on the cards, else the least-lightened mix that does. */
export function readableInk(color: string, min = 4.5): string {
  const hit = cache.get(color);
  if (hit) return hit;
  const c = rgb(color);
  let out = color; // non-hex input is passed through unchanged
  if (c) {
    for (let t = 0; t <= 1; t += 0.05) {
      const mix = c.map((v) => Math.round(v + (255 - v) * t));
      out = "#" + mix.map((v) => v.toString(16).padStart(2, "0")).join("");
      if (contrast(out, SURFACE_2) >= min) break;
    }
  }
  cache.set(color, out);
  return out;
}
