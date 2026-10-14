import type { Motion, ParticleKind } from "../../shared";
import { glowSprite, rgba } from "./color";
import type { AuraEnv } from "./registry";

export interface Particle {
  x: number;
  y: number;
  /** Angle et distance au centre (mouvements circulaires). */
  a: number;
  d: number;
  vx: number;
  vy: number;
  /** Progression de vie dans [0, 1]. */
  life: number;
  lifeSpeed: number;
  size: number;
  rot: number;
  vr: number;
  phase: number;
  color: string;
  glyph: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function spawn(p: Partial<Particle>, env: AuraEnv, motion: Motion, colors: string[], size: number, initial: boolean): Particle {
  const { cx, cy, r } = env;
  const base: Particle = {
    x: cx,
    y: cy,
    a: rand(0, Math.PI * 2),
    d: r * rand(0.6, 1.25),
    vx: 0,
    vy: 0,
    life: initial ? Math.random() : 0,
    lifeSpeed: rand(0.18, 0.4),
    size: size * rand(0.6, 1.3),
    rot: rand(0, Math.PI * 2),
    vr: rand(-2, 2),
    phase: rand(0, 100),
    color: colors[Math.floor(Math.random() * colors.length)],
    glyph: Math.floor(Math.random() * 5),
    ...p,
  };
  switch (motion) {
    case "rise":
      base.x = cx + rand(-0.85, 0.85) * r;
      base.y = cy + r * rand(0.2, 0.9);
      base.vy = -r * rand(0.35, 0.8);
      break;
    case "fall":
      base.x = cx + rand(-1.1, 1.1) * r;
      base.y = cy - r * rand(0.9, 1.4);
      base.vy = r * rand(0.35, 0.7);
      break;
    case "drift":
      base.x = cx + Math.cos(base.a) * base.d;
      base.y = cy + Math.sin(base.a) * base.d;
      base.vx = rand(-0.2, 0.2) * r;
      base.vy = rand(-0.2, 0.2) * r;
      break;
    case "spiral-in":
      base.d = r * rand(1.3, 1.8);
      break;
    case "spiral-out":
      base.d = r * rand(0.05, 0.3);
      break;
    case "orbit":
      base.lifeSpeed = rand(0.08, 0.16);
      break;
  }
  return base;
}

/** Avance une particule ; renvoie false quand elle doit être recréée. */
export function step(p: Particle, motion: Motion, dt: number, t: number, env: AuraEnv, speed: number): boolean {
  const { cx, cy, r } = env;
  p.life += p.lifeSpeed * dt * speed;
  p.rot += p.vr * dt * speed;
  switch (motion) {
    case "rise":
    case "fall":
      p.y += p.vy * dt * speed;
      p.x += Math.sin(t * 1.5 + p.phase) * r * 0.25 * dt;
      break;
    case "drift":
      p.vx += rand(-1, 1) * r * dt * 0.4;
      p.vy += rand(-1, 1) * r * dt * 0.4;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.x += p.vx * dt * speed;
      p.y += p.vy * dt * speed;
      break;
    case "orbit": {
      p.a += (0.5 + (r / p.d) * 0.3) * dt * speed;
      const wobble = Math.sin(t * 2 + p.phase) * r * 0.06;
      p.x = cx + Math.cos(p.a) * (p.d + wobble);
      p.y = cy + Math.sin(p.a) * (p.d + wobble) * 0.85;
      break;
    }
    case "spiral-in":
      p.a += (1.2 + r / Math.max(p.d, r * 0.1)) * dt * speed * 0.6;
      p.d -= r * 0.55 * dt * speed;
      p.x = cx + Math.cos(p.a) * p.d;
      p.y = cy + Math.sin(p.a) * p.d * 0.85;
      if (p.d < r * 0.08) return false;
      break;
    case "spiral-out":
      p.a += 1.1 * dt * speed;
      p.d += r * 0.5 * dt * speed;
      p.x = cx + Math.cos(p.a) * p.d;
      p.y = cy + Math.sin(p.a) * p.d * 0.85;
      if (p.d > r * 1.8) return false;
      break;
  }
  return p.life < 1;
}

function fade(p: Particle): number {
  return Math.sin(Math.min(1, Math.max(0, p.life)) * Math.PI);
}

const GLYPHS: ((g: CanvasRenderingContext2D, s: number) => void)[] = [
  (g, s) => {
    g.arc(0, 0, s, 0, Math.PI * 2);
    g.moveTo(0, -s * 1.5);
    g.lineTo(0, s * 1.5);
  },
  (g, s) => {
    g.moveTo(0, -s);
    g.lineTo(s, s);
    g.lineTo(-s, s);
    g.closePath();
    g.moveTo(0, -s * 0.2);
    g.lineTo(0, s * 0.5);
  },
  (g, s) => {
    g.moveTo(-s, -s);
    g.lineTo(s, s);
    g.moveTo(s, -s);
    g.lineTo(-s, s);
    g.moveTo(-s, 0);
    g.lineTo(s, 0);
  },
  (g, s) => {
    g.moveTo(0, -s * 1.3);
    g.lineTo(0, s * 1.3);
    g.moveTo(0, -s * 0.6);
    g.lineTo(s * 0.8, -s * 1.2);
    g.moveTo(0, 0);
    g.lineTo(s * 0.8, -s * 0.6);
  },
  (g, s) => {
    g.arc(0, 0, s, Math.PI * 0.2, Math.PI * 1.8);
    g.moveTo(s * 0.5, 0);
    g.arc(0, 0, s * 0.5, 0, Math.PI * 2);
  },
];

export function drawParticle(g: CanvasRenderingContext2D, p: Particle, kind: ParticleKind) {
  const alpha = fade(p);
  if (alpha <= 0.01) return;
  const s = p.size;
  switch (kind) {
    case "dust":
    case "ember":
    case "star":
    case "spark": {
      const sprite = glowSprite(p.color);
      const gs = s * (kind === "ember" ? 5 : 4);
      g.globalAlpha = alpha * 0.9;
      g.drawImage(sprite, p.x - gs / 2, p.y - gs / 2, gs, gs);
      g.globalAlpha = alpha;
      g.fillStyle = kind === "ember" ? rgba("#fff3d6", alpha) : "#fff";
      if (kind === "star") {
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot * 0.3);
        g.beginPath();
        for (let i = 0; i < 4; i++) {
          g.rotate(Math.PI / 2);
          g.moveTo(0, 0);
          g.quadraticCurveTo(s * 0.25, s * 0.25, 0, s * 1.8);
          g.quadraticCurveTo(-s * 0.25, s * 0.25, 0, 0);
        }
        g.fill();
        g.restore();
      } else if (kind === "spark") {
        g.strokeStyle = rgba("#ffffff", alpha);
        g.lineWidth = Math.max(1, s * 0.35);
        g.beginPath();
        g.moveTo(p.x - p.vx * 0.04 - s, p.y - p.vy * 0.04);
        g.lineTo(p.x + s, p.y);
        g.stroke();
      } else {
        g.beginPath();
        g.arc(p.x, p.y, s * 0.45, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case "mist": {
      const sprite = glowSprite(p.color);
      const gs = s * 14;
      g.globalAlpha = alpha * 0.18;
      g.drawImage(sprite, p.x - gs / 2, p.y - gs / 2, gs, gs);
      break;
    }
    default: {
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.globalAlpha = alpha;
      g.fillStyle = rgba(p.color, 0.85);
      g.strokeStyle = rgba(p.color, 0.95);
      g.lineWidth = Math.max(1, s * 0.25);
      g.beginPath();
      switch (kind) {
        case "drop":
          g.rotate(-p.rot);
          g.moveTo(0, -s * 1.4);
          g.quadraticCurveTo(s, s * 0.3, 0, s);
          g.quadraticCurveTo(-s, s * 0.3, 0, -s * 1.4);
          g.fill();
          break;
        case "leaf":
          g.ellipse(0, 0, s * 1.4, s * 0.6, 0, 0, Math.PI * 2);
          g.fill();
          g.beginPath();
          g.strokeStyle = rgba("#ffffff", 0.35);
          g.moveTo(-s * 1.3, 0);
          g.lineTo(s * 1.3, 0);
          g.stroke();
          break;
        case "petal":
          g.scale(Math.cos(p.rot * 0.7), 1);
          g.ellipse(0, 0, s * 1.1, s * 0.7, 0, 0, Math.PI * 2);
          g.fill();
          break;
        case "bubble":
          g.arc(0, 0, s, 0, Math.PI * 2);
          g.stroke();
          g.beginPath();
          g.fillStyle = rgba("#ffffff", 0.6);
          g.arc(-s * 0.35, -s * 0.35, s * 0.25, 0, Math.PI * 2);
          g.fill();
          break;
        case "snow":
          for (let i = 0; i < 3; i++) {
            g.rotate(Math.PI / 3);
            g.moveTo(-s, 0);
            g.lineTo(s, 0);
          }
          g.stroke();
          break;
        case "shard":
          g.moveTo(0, -s * 1.5);
          g.lineTo(s * 0.7, s * 0.6);
          g.lineTo(-s * 0.5, s);
          g.closePath();
          g.globalAlpha = alpha * 0.6;
          g.fill();
          g.globalAlpha = alpha;
          g.stroke();
          break;
        case "feather":
          g.moveTo(0, -s * 2);
          g.quadraticCurveTo(s * 1.1, 0, 0, s * 2);
          g.quadraticCurveTo(-s * 0.6, 0, 0, -s * 2);
          g.fill();
          break;
        case "glyph":
          GLYPHS[p.glyph](g, s);
          g.stroke();
          break;
      }
      g.restore();
    }
  }
  g.globalAlpha = 1;
}
