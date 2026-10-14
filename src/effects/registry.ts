/**
 * Registre des couches d'effets d'aura.
 *
 * Pour ajouter un effet :
 *   1. déclarer son type dans `LayerSpec` (shared/visuals.ts) ;
 *   2. appeler `registerLayer("monType", (spec, env) => ({ draw(g, t, dt, env) { ... } }))`
 *      ici ou dans un autre module importé au démarrage ;
 *   3. l'utiliser dans `visual.layers` d'une aura.
 */
import type { LayerSpec } from "../../shared";
import { glowSprite, rgba } from "./color";
import { drawParticle, spawn, step, type Particle } from "./particles";

export interface AuraEnv {
  w: number;
  h: number;
  cx: number;
  cy: number;
  /** Rayon de référence de l'aura (en px CSS). */
  r: number;
  primary: string;
  secondary: string;
  /** Multiplicateur de densité (0..1+). */
  density: number;
  /** Multiplicateur de vitesse (réduit en mode animations réduites). */
  speed: number;
  noFlashes: boolean;
}

export interface LayerInstance {
  draw(g: CanvasRenderingContext2D, t: number, dt: number, env: AuraEnv): void;
}

type SpecOf<K extends LayerSpec["type"]> = Extract<LayerSpec, { type: K }>;
type Factory<K extends LayerSpec["type"]> = (spec: SpecOf<K>, env: AuraEnv) => LayerInstance;

const registry: { [K in LayerSpec["type"]]?: Factory<K> } = {};

export function registerLayer<K extends LayerSpec["type"]>(type: K, factory: Factory<K>) {
  (registry as Record<string, unknown>)[type] = factory;
}

export function createLayer(spec: LayerSpec, env: AuraEnv): LayerInstance | null {
  const factory = registry[spec.type] as Factory<typeof spec.type> | undefined;
  return factory ? factory(spec as never, env) : null;
}

/** Couches dessinées derrière le personnage ; les autres passent devant. */
export const BACK_LAYERS: ReadonlySet<LayerSpec["type"]> = new Set(["rays", "starfield", "void", "halo", "rings"]);

// ───────────────────────── Implémentations ─────────────────────────

registerLayer("halo", (spec) => ({
  draw(g, t, _dt, env) {
    const pulse = spec.pulse ? 1 + 0.07 * Math.sin(t * spec.pulse * Math.PI * 2) : 1;
    const R = env.r * 1.45 * pulse;
    const grad = g.createRadialGradient(env.cx, env.cy, env.r * 0.1, env.cx, env.cy, R);
    grad.addColorStop(0, rgba(env.primary, 0.55 * spec.intensity));
    grad.addColorStop(0.45, rgba(env.secondary, 0.28 * spec.intensity));
    grad.addColorStop(1, rgba(env.secondary, 0));
    g.globalCompositeOperation = "lighter";
    g.fillStyle = grad;
    g.beginPath();
    g.arc(env.cx, env.cy, R, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = "source-over";
  },
}));

registerLayer("particles", (spec, env0) => {
  const colors = spec.colors ?? [env0.primary, env0.secondary];
  const count = Math.max(3, Math.round(spec.count * env0.density));
  const size = (spec.size ?? 1) * Math.max(1.6, env0.r * 0.035);
  const parts: Particle[] = Array.from({ length: count }, () => spawn({}, env0, spec.motion, colors, size, true));
  // Les particules initiales en spirale démarrent à une distance aléatoire.
  if (spec.motion.startsWith("spiral")) for (const p of parts) p.d = env0.r * (0.1 + Math.random() * 1.6);
  return {
    draw(g, t, dt, env) {
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (!step(p, spec.motion, dt, t, env, (spec.speed ?? 1) * env.speed)) {
          parts[i] = spawn({}, env, spec.motion, colors, size, false);
        }
        drawParticle(g, parts[i], spec.kind);
      }
      g.globalCompositeOperation = "source-over";
    },
  };
});

registerLayer("rings", (spec) => ({
  draw(g, t, _dt, env) {
    const squash = 1 - (spec.tilt ?? 0) * 0.75;
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < spec.count; i++) {
      const R = env.r * (1.05 + i * 0.17);
      const rot = t * spec.speed * env.speed * (i % 2 ? -1 : 1) + i;
      g.save();
      g.translate(env.cx, env.cy);
      g.scale(1, squash);
      g.rotate(rot);
      g.lineWidth = Math.max(1, env.r * 0.018);
      g.strokeStyle = rgba(i % 2 ? env.secondary : env.primary, 0.55 - i * 0.05);
      g.setLineDash([R * 0.5, R * 0.18, R * 0.08, R * 0.18]);
      g.beginPath();
      g.arc(0, 0, R, 0, Math.PI * 2);
      g.stroke();
      // nœud lumineux qui parcourt l'anneau
      const sprite = glowSprite(env.primary);
      const s = env.r * 0.18;
      g.drawImage(sprite, R - s / 2, -s / 2, s, s);
      g.restore();
    }
    g.setLineDash([]);
    g.globalCompositeOperation = "source-over";
  },
}));

function boltPath(x1: number, y1: number, x2: number, y2: number, spread: number, depth: number, out: number[]) {
  if (depth === 0) {
    out.push(x2, y2);
    return;
  }
  const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * spread;
  const my = (y1 + y2) / 2 + (Math.random() - 0.5) * spread;
  boltPath(x1, y1, mx, my, spread / 2, depth - 1, out);
  boltPath(mx, my, x2, y2, spread / 2, depth - 1, out);
}

registerLayer("lightning", (spec) => {
  let bolts: { pts: number[]; life: number }[] = [];
  return {
    draw(g, _t, dt, env) {
      const rate = spec.rate * (env.noFlashes ? 0.35 : 1) * env.speed;
      if (Math.random() < rate * dt * 3) {
        const a = Math.random() * Math.PI * 2;
        const x1 = env.cx + Math.cos(a) * env.r * 0.3;
        const y1 = env.cy + Math.sin(a) * env.r * 0.3;
        const x2 = env.cx + Math.cos(a + (Math.random() - 0.5)) * env.r * 1.5;
        const y2 = env.cy + Math.sin(a + (Math.random() - 0.5)) * env.r * 1.5;
        const pts = [x1, y1];
        boltPath(x1, y1, x2, y2, env.r * 0.5, 5, pts);
        bolts.push({ pts, life: 1 });
      }
      g.globalCompositeOperation = "lighter";
      g.lineJoin = "round";
      for (const b of bolts) {
        const alpha = b.life * (env.noFlashes ? 0.5 : 1);
        for (const [w, c] of [
          [env.r * 0.06, rgba(env.primary, alpha * 0.35)],
          [Math.max(1, env.r * 0.015), rgba("#ffffff", alpha)],
        ] as const) {
          g.lineWidth = w;
          g.strokeStyle = c;
          g.beginPath();
          g.moveTo(b.pts[0], b.pts[1]);
          for (let i = 2; i < b.pts.length; i += 2) g.lineTo(b.pts[i], b.pts[i + 1]);
          g.stroke();
        }
        b.life -= dt * 5;
      }
      bolts = bolts.filter((b) => b.life > 0);
      g.globalCompositeOperation = "source-over";
    },
  };
});

registerLayer("rays", (spec) => ({
  draw(g, t, _dt, env) {
    const R = env.r * 2.4;
    g.save();
    g.translate(env.cx, env.cy);
    g.rotate(t * spec.speed * env.speed);
    g.globalCompositeOperation = "lighter";
    const grad = g.createRadialGradient(0, 0, env.r * 0.2, 0, 0, R);
    grad.addColorStop(0, rgba(env.primary, 0.32));
    grad.addColorStop(1, rgba(env.primary, 0));
    g.fillStyle = grad;
    const w = (Math.PI / spec.count) * 0.45;
    g.beginPath();
    for (let i = 0; i < spec.count; i++) {
      const a = (i / spec.count) * Math.PI * 2;
      g.moveTo(0, 0);
      g.arc(0, 0, R, a - w / 2, a + w / 2);
    }
    g.fill();
    g.restore();
    g.globalCompositeOperation = "source-over";
  },
}));

registerLayer("starfield", (spec, env0) => {
  const stars = Array.from({ length: Math.round(spec.count * env0.density) }, () => ({
    x: Math.random(),
    y: Math.random(),
    s: 0.5 + Math.random() * 1.4,
    f: 0.5 + Math.random() * 2,
    p: Math.random() * 10,
  }));
  return {
    draw(g, t, _dt, env) {
      g.fillStyle = "#fff";
      for (const s of stars) {
        g.globalAlpha = 0.25 + 0.6 * Math.abs(Math.sin(t * s.f * env.speed + s.p));
        g.beginPath();
        g.arc(s.x * env.w, s.y * env.h, s.s, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    },
  };
});

registerLayer("void", (spec) => ({
  draw(g, t, _dt, env) {
    const R = env.r * spec.radius * 1.6;
    const grad = g.createRadialGradient(env.cx, env.cy, 0, env.cx, env.cy, R);
    grad.addColorStop(0, "rgba(0,0,0,0.95)");
    grad.addColorStop(0.6, "rgba(0,0,0,0.8)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(env.cx, env.cy, R, 0, Math.PI * 2);
    g.fill();
    // disque d'accrétion
    g.globalCompositeOperation = "lighter";
    g.lineWidth = Math.max(1.5, env.r * 0.03);
    g.strokeStyle = rgba(env.primary, 0.5 + 0.2 * Math.sin(t * 3));
    g.beginPath();
    g.arc(env.cx, env.cy, R * 0.62, 0, Math.PI * 2);
    g.stroke();
    g.globalCompositeOperation = "source-over";
  },
}));

registerLayer("glitch", (spec) => {
  let bars: { y: number; h: number; dx: number; life: number; c: string }[] = [];
  return {
    draw(g, _t, dt, env) {
      const rate = spec.rate * (env.noFlashes ? 0.3 : 1) * env.speed;
      if (Math.random() < rate * dt * 4) {
        const n = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
          bars.push({
            y: env.cy + (Math.random() - 0.5) * env.r * 2.4,
            h: 2 + Math.random() * env.r * 0.08,
            dx: (Math.random() - 0.5) * env.r * 0.6,
            life: 1,
            c: Math.random() < 0.5 ? env.primary : env.secondary,
          });
        }
      }
      g.globalCompositeOperation = "lighter";
      for (const b of bars) {
        g.fillStyle = rgba(b.c, 0.45 * b.life);
        g.fillRect(env.cx - env.r * 1.2 + b.dx, b.y, env.r * 2.4, b.h);
        b.life -= dt * 8;
      }
      bars = bars.filter((b) => b.life > 0);
      g.globalCompositeOperation = "source-over";
    },
  };
});
