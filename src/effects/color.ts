const cache = new Map<string, [number, number, number]>();

export function hexToRgb(hex: string): [number, number, number] {
  let rgb = cache.get(hex);
  if (!rgb) {
    let h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const n = parseInt(h, 16);
    rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    cache.set(hex, rgb);
  }
  return rgb;
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}

/** Sprite de lueur radiale pré-rendu (beaucoup plus rapide que shadowBlur). */
const sprites = new Map<string, HTMLCanvasElement>();
export function glowSprite(color: string): HTMLCanvasElement {
  let c = sprites.get(color);
  if (!c) {
    c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, rgba(color, 1));
    grad.addColorStop(0.25, rgba(color, 0.55));
    grad.addColorStop(1, rgba(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    sprites.set(color, c);
  }
  return c;
}
