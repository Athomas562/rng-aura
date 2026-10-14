import { useEffect, useRef } from "react";
import type { Aura } from "../../shared";
import { useSettings } from "../settings/SettingsContext";
import { BACK_LAYERS, createLayer, type AuraEnv, type LayerInstance } from "./registry";

interface Props {
  aura: Aura;
  /** Quelles couches dessiner (pour encadrer un personnage : back derrière, front devant). */
  part?: "back" | "front" | "all";
  /** Rayon de l'aura relatif au plus petit côté du canvas. */
  radius?: number;
  /** Position verticale du centre (0..1). */
  centerY?: number;
  density?: number;
  className?: string;
}

/**
 * Rend les couches d'une aura sur un canvas qui remplit son conteneur.
 * L'animation se met en pause hors écran et quand l'onglet est masqué.
 */
export function AuraCanvas({ aura, part = "all", radius = 0.3, centerY = 0.5, density = 1, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { settings } = useSettings();
  const reduced = settings.reducedMotion;
  const noFlashes = settings.noFlashes;

  useEffect(() => {
    const canvas = ref.current!;
    const g = canvas.getContext("2d");
    if (!g) return;

    const env: AuraEnv = {
      w: 1,
      h: 1,
      cx: 0,
      cy: 0,
      r: 1,
      primary: aura.visual.primary,
      secondary: aura.visual.secondary,
      density: density * (reduced ? 0.5 : 1),
      speed: reduced ? 0.4 : 1,
      noFlashes,
    };
    let layers: LayerInstance[] = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      env.w = rect.width;
      env.h = rect.height;
      env.cx = rect.width / 2;
      env.cy = rect.height * centerY;
      env.r = Math.min(rect.width, rect.height) * radius;
      layers = aura.visual.layers
        .filter((l) => part === "all" || (part === "back") === BACK_LAYERS.has(l.type))
        .map((l) => createLayer(l, env))
        .filter((l): l is LayerInstance => l !== null);
    };
    resize();

    let raf = 0;
    let last = performance.now();
    let visible = true;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      g.clearRect(0, 0, env.w, env.h);
      const t = now / 1000;
      for (const l of layers) l.draw(g, t, dt, env);
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (raf || !visible || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start();
      else stop();
    });
    io.observe(canvas);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    start();

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [aura, part, radius, centerY, density, reduced, noFlashes]);

  return (
    <canvas
      ref={ref}
      className={`aura-canvas ${aura.visual.hueShift && !noFlashes ? "hue-shift" : ""} ${className ?? ""}`}
      aria-hidden="true"
    />
  );
}
