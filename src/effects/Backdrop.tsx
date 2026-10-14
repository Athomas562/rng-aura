import { useEffect, useRef } from "react";
import { useSettings } from "../settings/SettingsContext";
import { glowSprite } from "./color";

const COLORS = ["#9b6bff", "#3ee0ff", "#c9a6ff", "#6a7bff", "#ffffff"];

/** Fond animé : particules lumineuses flottantes. Statique en mode animations réduites. */
export function Backdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  const { settings } = useSettings();
  const reduced = settings.reducedMotion;

  useEffect(() => {
    const canvas = ref.current!;
    const g = canvas.getContext("2d");
    if (!g) return;
    let w = 0;
    let h = 0;
    type Mote = { x: number; y: number; s: number; vx: number; vy: number; c: string; p: number };
    let motes: Mote[] = [];

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(90, (w * h) / 16000));
      motes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        s: 1 + Math.random() * 2.6,
        vx: (Math.random() - 0.5) * 6,
        vy: -4 - Math.random() * 10,
        c: COLORS[Math.floor(Math.random() * COLORS.length)],
        p: Math.random() * 10,
      }));
    };

    const draw = (t: number, dt: number) => {
      g.clearRect(0, 0, w, h);
      g.globalCompositeOperation = "lighter";
      for (const m of motes) {
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        if (m.y < -20) {
          m.y = h + 20;
          m.x = Math.random() * w;
        }
        if (m.x < -20) m.x = w + 20;
        if (m.x > w + 20) m.x = -20;
        const a = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(t * 0.8 + m.p));
        const size = m.s * 7;
        g.globalAlpha = a;
        g.drawImage(glowSprite(m.c), m.x - size / 2, m.y - size / 2, size, size);
      }
      g.globalAlpha = 1;
    };

    resize();
    window.addEventListener("resize", resize);
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      draw(now / 1000, Math.min(0.05, (now - last) / 1000));
      last = now;
      raf = requestAnimationFrame(frame);
    };
    if (reduced) draw(0, 0);
    else raf = requestAnimationFrame(frame);
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduced) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reduced]);

  return (
    <div className="backdrop" aria-hidden="true">
      <canvas ref={ref} />
    </div>
  );
}
