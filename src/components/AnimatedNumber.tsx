import { useEffect, useRef, useState } from "react";
import { useSettings } from "../settings/SettingsContext";

const nf = new Intl.NumberFormat("fr-FR");

/**
 * Nombre dont les chiffres « roulent » vers la nouvelle valeur (≈ 450 ms).
 * Instantané si les animations sont réduites ou en mode calme. Le texte lu par
 * les lecteurs d'écran est toujours la valeur finale.
 */
export function AnimatedNumber({ value, className, format = (n) => nf.format(n) }: { value: number; className?: string; format?: (n: number) => string }) {
  const { settings } = useSettings();
  const instant = settings.reducedMotion || settings.calmMode;
  const [shown, setShown] = useState(value);
  const [bump, setBump] = useState<"up" | "down" | null>(null);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (start === value) return;
    if (instant) {
      setShown(value);
      return;
    }
    setBump(value > start ? "up" : "down");
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 450);
      const e = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(start + (value - start) * e));
      if (p < 1) raf = requestAnimationFrame(step);
      else setBump(null);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, instant]);

  return (
    <span className={`anim-number ${bump ? `is-${bump}` : ""} ${className ?? ""}`} aria-label={format(value)}>
      <span aria-hidden="true">{format(shown)}</span>
    </span>
  );
}
