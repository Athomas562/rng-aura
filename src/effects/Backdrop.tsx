import { useEffect, useRef } from "react";
import { decorativeMotion, vfxDensity } from "../settings/settings";
import { useSettings } from "../settings/SettingsContext";
import { glowSprite, rgba } from "./color";

const COLORS = ["#9b6bff", "#3ee0ff", "#c9a6ff", "#6a7bff", "#ffffff"];
const AMBIENT_EVENT = "aura-ambient";

/** Signale au fond la couleur de rareté de la dernière aura obtenue. */
export function emitAmbient(color: string) {
  window.dispatchEvent(new CustomEvent(AMBIENT_EVENT, { detail: color }));
}

/**
 * Fond d'ambiance : dégradé lent + particules qui flottent, teinté par la rareté de la
 * dernière aura obtenue. Statique (un seul dessin, aucune boucle) en mode calme
 * ou si les animations sont réduites. La densité suit la qualité VFX.
 */
export function Backdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  const { settings } = useSettings();
  const moving = decorativeMotion(settings);
  const density = vfxDensity(settings);

  useEffect(() => {
    const canvas = ref.current!;
    const g = canvas.getContext("2d");
    if (!g) return;
    let w = 0;
    let h = 0;
    type Mote = { x: number; y: number; s: number; vx: number; vy: number; c: string; p: number };
    let motes: Mote[] = [];
    let tint: string | null = null;
    let tintLevel = 0;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(110, ((w * h) / 16000) * density));
      motes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        s: 1 + Math.random() * 2.6,
        vx: (Math.random() - 0.5) * 6,
        vy: -4 - Math.random() * 10,
        c: COLORS[Math.floor(Math.random() * COLORS.length)],
        p: Math.random() * 10,
      }));
      if (!moving) draw(0, 0);
    };

    function draw(t: number, dt: number) {
      g!.clearRect(0, 0, w, h);
      // dégradé d'ambiance qui dérive lentement et prend la couleur de la dernière rareté
      if (tint && tintLevel > 0.01) {
        const cx = w * (0.5 + 0.18 * Math.sin(t * 0.05));
        const cy = h * (0.45 + 0.12 * Math.cos(t * 0.04));
        const grad = g!.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7);
        grad.addColorStop(0, rgba(tint, 0.14 * tintLevel));
        grad.addColorStop(1, rgba(tint, 0));
        g!.fillStyle = grad;
        g!.fillRect(0, 0, w, h);
      }
      g!.globalCompositeOperation = "lighter";
      for (const m of motes) {
        m.x += m.vx * dt;
        m.y += m.vy * dt * (1 + tintLevel);
        if (m.y < -20) {
          m.y = h + 20;
          m.x = Math.random() * w;
          if (tint && Math.random() < 0.5) m.c = tint;
        }
        if (m.x < -20) m.x = w + 20;
        if (m.x > w + 20) m.x = -20;
        const a = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(t * 0.8 + m.p));
        const size = m.s * 7;
        g!.globalAlpha = a;
        g!.drawImage(glowSprite(m.c), m.x - size / 2, m.y - size / 2, size, size);
      }
      g!.globalAlpha = 1;
      g!.globalCompositeOperation = "source-over";
    }

    const onAmbient = (e: Event) => {
      tint = (e as CustomEvent<string>).detail;
      tintLevel = 1;
      if (!moving) draw(0, 0);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener(AMBIENT_EVENT, onAmbient);
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      tintLevel = Math.max(0.25, tintLevel - dt * 0.05);
      draw(now / 1000, dt);
      raf = requestAnimationFrame(frame);
    };
    if (moving) raf = requestAnimationFrame(frame);
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && moving) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener(AMBIENT_EVENT, onAmbient);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [moving, density]);

  return (
    <div className="backdrop" aria-hidden="true">
      <canvas ref={ref} />
    </div>
  );
}
