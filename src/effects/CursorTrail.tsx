import { useEffect, useRef } from "react";
import { getCosmetic } from "../../shared";
import { useGame } from "../game/GameContext";
import { decorativeMotion, vfxDensity } from "../settings/settings";
import { useSettings } from "../settings/SettingsContext";
import { glowSprite } from "./color";

const MAX_PARTICLES = 140;

/**
 * Traînée de particules qui suit le curseur (cosmétique acheté en boutique).
 * Désactivée par le réglage dédié, « réduire les animations » et le mode calme.
 * Les particules sont recyclées dans un tableau de taille fixe, et la boucle s'arrête
 * d'elle-même quand il n'y a plus rien à dessiner (aucune fuite mémoire).
 */
export function CursorTrail() {
  const { state } = useGame();
  const { settings } = useSettings();
  const ref = useRef<HTMLCanvasElement>(null);
  const trail = state.cosmetics.trail ? getCosmetic(state.cosmetics.trail) : null;
  const enabled = Boolean(trail) && settings.cursorTrail && decorativeMotion(settings);
  const density = vfxDensity(settings);

  useEffect(() => {
    if (!enabled || !trail) return;
    const canvas = ref.current!;
    const g = canvas.getContext("2d");
    if (!g) return;
    type P = { x: number; y: number; vx: number; vy: number; life: number; s: number; c: string };
    const parts: P[] = [];
    let raf = 0;
    let last = performance.now();
    let w = 0;
    let h = 0;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      g.clearRect(0, 0, w, h);
      g.globalCompositeOperation = "lighter";
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life -= dt * 1.6;
        if (p.life <= 0) {
          parts.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 40 * dt;
        const size = p.s * (0.4 + p.life);
        g.globalAlpha = p.life * 0.8;
        g.drawImage(glowSprite(p.c), p.x - size / 2, p.y - size / 2, size, size);
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
      raf = parts.length ? requestAnimationFrame(frame) : 0;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const n = Math.max(1, Math.round(2 * density));
      for (let i = 0; i < n && parts.length < MAX_PARTICLES; i++) {
        parts.push({
          x: e.clientX + (Math.random() - 0.5) * 6,
          y: e.clientY + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 30,
          vy: (Math.random() - 0.5) * 30 - 10,
          life: 1,
          s: 8 + Math.random() * 10,
          c: trail.colors[Math.floor(Math.random() * trail.colors.length)],
        });
      }
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      parts.length = 0;
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, [enabled, trail, density]);

  if (!enabled) return null;
  return <canvas ref={ref} className="cursor-trail" aria-hidden="true" />;
}
