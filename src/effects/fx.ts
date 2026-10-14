/**
 * Effets ponctuels des animations de découverte : ondes de choc, explosions
 * de particules, éclairs, distorsion en étoile (warp)...
 * Un seul canvas, une boucle qui s'arrête d'elle-même quand il n'y a plus rien à dessiner.
 */
import { glowSprite, rgba } from "./color";

interface Effect {
  /** Renvoie false quand l'effet est terminé. */
  draw(g: CanvasRenderingContext2D, dt: number, w: number, h: number): boolean;
}

export interface FxOptions {
  reduced: boolean;
  noFlashes: boolean;
}

export class FxEngine {
  private g: CanvasRenderingContext2D | null;
  private effects: Effect[] = [];
  private raf = 0;
  private last = 0;
  private w = 0;
  private h = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private opts: FxOptions,
  ) {
    this.g = canvas.getContext("2d");
    this.resize();
  }

  setOptions(opts: FxOptions) {
    this.opts = opts;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = rect.width;
    this.h = rect.height;
    this.canvas.width = Math.max(1, rect.width * dpr);
    this.canvas.height = Math.max(1, rect.height * dpr);
    this.g?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  get center() {
    return { x: this.w / 2, y: this.h / 2, r: Math.min(this.w, this.h) };
  }

  private add(e: Effect) {
    this.effects.push(e);
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.frame);
    }
  }

  private frame = (now: number) => {
    const g = this.g;
    if (!g) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    g.clearRect(0, 0, this.w, this.h);
    this.effects = this.effects.filter((e) => e.draw(g, dt, this.w, this.h));
    this.raf = this.effects.length ? requestAnimationFrame(this.frame) : 0;
    if (!this.raf) g.clearRect(0, 0, this.w, this.h);
  };

  clear() {
    this.effects = [];
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.effects = [];
  }

  /** Onde de choc circulaire. */
  shockwave(color: string, delay = 0, strength = 1) {
    let t = -delay;
    const dur = 0.9;
    this.add({
      draw: (g, dt, w, h) => {
        t += dt;
        if (t < 0) return true;
        const p = t / dur;
        const R = Math.max(w, h) * 0.6 * easeOut(p) * strength;
        g.globalCompositeOperation = "lighter";
        g.lineWidth = 18 * (1 - p) + 1;
        g.strokeStyle = rgba(color, 0.8 * (1 - p));
        g.beginPath();
        g.arc(w / 2, h / 2, R, 0, Math.PI * 2);
        g.stroke();
        g.lineWidth = 3 * (1 - p) + 0.5;
        g.strokeStyle = rgba("#ffffff", 0.7 * (1 - p));
        g.stroke();
        g.globalCompositeOperation = "source-over";
        return p < 1;
      },
    });
  }

  /** Explosion de particules depuis le centre. */
  burst(colors: string[], count: number, speed = 1) {
    const n = this.opts.reduced ? Math.round(count / 3) : count;
    const { r } = this.center;
    const parts = Array.from({ length: n }, () => {
      const a = Math.random() * Math.PI * 2;
      const v = (0.25 + Math.random() * 0.75) * r * 0.9 * speed;
      return {
        x: 0,
        y: 0,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        s: 2 + Math.random() * 5,
        c: colors[Math.floor(Math.random() * colors.length)],
        life: 1,
        decay: 0.5 + Math.random() * 0.7,
      };
    });
    this.add({
      draw: (g, dt, w, h) => {
        g.globalCompositeOperation = "lighter";
        let alive = false;
        for (const p of parts) {
          if (p.life <= 0) continue;
          alive = true;
          p.vx *= 1 - 1.6 * dt;
          p.vy *= 1 - 1.6 * dt;
          p.vy += 30 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= p.decay * dt;
          const size = p.s * 6;
          g.globalAlpha = Math.max(0, p.life);
          g.drawImage(glowSprite(p.c), w / 2 + p.x - size / 2, h / 2 + p.y - size / 2, size, size);
        }
        g.globalAlpha = 1;
        g.globalCompositeOperation = "source-over";
        return alive;
      },
    });
  }

  /** Éclairs partant du centre vers les bords. */
  lightning(color: string, count: number, overMs: number) {
    if (this.opts.noFlashes) count = Math.ceil(count / 3);
    let t = 0;
    const dur = overMs / 1000;
    const strikes = Array.from({ length: count }, () => ({ at: Math.random() * dur, pts: [] as number[], life: 0 }));
    this.add({
      draw: (g, dt, w, h) => {
        t += dt;
        g.globalCompositeOperation = "lighter";
        g.lineJoin = "round";
        for (const s of strikes) {
          if (t >= s.at && s.pts.length === 0) {
            const a = Math.random() * Math.PI * 2;
            const R = Math.max(w, h) * 0.7;
            s.pts = jagged(w / 2, h / 2, w / 2 + Math.cos(a) * R, h / 2 + Math.sin(a) * R, R * 0.25);
            s.life = 1;
          }
          if (s.life <= 0) continue;
          const alpha = s.life * (this.opts.noFlashes ? 0.5 : 1);
          for (const [lw, c] of [
            [10, rgba(color, alpha * 0.3)],
            [2, rgba("#ffffff", alpha)],
          ] as const) {
            g.lineWidth = lw;
            g.strokeStyle = c;
            g.beginPath();
            g.moveTo(s.pts[0], s.pts[1]);
            for (let i = 2; i < s.pts.length; i += 2) g.lineTo(s.pts[i], s.pts[i + 1]);
            g.stroke();
          }
          s.life -= dt * 4;
        }
        g.globalCompositeOperation = "source-over";
        return t < dur || strikes.some((s) => s.life > 0);
      },
    });
  }

  /** Traînées d'étoiles qui jaillissent du centre (saut hyperespace). */
  warp(color: string, overMs: number, inward = false) {
    const n = this.opts.reduced ? 40 : 140;
    let t = 0;
    const dur = overMs / 1000;
    const stars = Array.from({ length: n }, () => ({
      a: Math.random() * Math.PI * 2,
      d: Math.random(),
      v: 0.4 + Math.random(),
      c: Math.random() < 0.3 ? "#ffffff" : color,
    }));
    this.add({
      draw: (g, dt, w, h) => {
        t += dt;
        const R = Math.hypot(w, h) / 2;
        const fade = Math.min(1, t / 0.3) * Math.min(1, (dur - t) / 0.4);
        g.globalCompositeOperation = "lighter";
        g.lineCap = "round";
        for (const s of stars) {
          s.d += (inward ? -1 : 1) * s.v * dt * (0.4 + s.d * 1.6);
          if (s.d > 1) s.d = 0.02;
          if (s.d < 0.02) s.d = 1;
          const d1 = s.d * R;
          const d0 = Math.max(0, d1 - (20 + s.d * 120) * s.v);
          g.strokeStyle = rgba(s.c, 0.7 * fade * s.d);
          g.lineWidth = 0.5 + s.d * 2.5;
          g.beginPath();
          g.moveTo(w / 2 + Math.cos(s.a) * d0, h / 2 + Math.sin(s.a) * d0);
          g.lineTo(w / 2 + Math.cos(s.a) * d1, h / 2 + Math.sin(s.a) * d1);
          g.stroke();
        }
        g.globalCompositeOperation = "source-over";
        return t < dur;
      },
    });
  }

  /** Particules aspirées vers le centre (présage, effondrement). */
  converge(color: string, overMs: number) {
    const n = this.opts.reduced ? 30 : 110;
    let t = 0;
    const dur = overMs / 1000;
    const parts = Array.from({ length: n }, () => ({ a: Math.random() * Math.PI * 2, d: 0.5 + Math.random() * 0.6, v: 0.3 + Math.random() * 0.6 }));
    this.add({
      draw: (g, dt, w, h) => {
        t += dt;
        const R = Math.max(w, h) * 0.6;
        g.globalCompositeOperation = "lighter";
        for (const p of parts) {
          p.d -= p.v * dt * (1 + t / dur);
          p.a += dt * 1.2;
          if (p.d < 0.02) p.d = 0.9 + Math.random() * 0.3;
          const s = 10 + 14 * p.d;
          g.globalAlpha = Math.min(1, t / 0.3) * 0.8;
          g.drawImage(glowSprite(color), w / 2 + Math.cos(p.a) * p.d * R - s / 2, h / 2 + Math.sin(p.a) * p.d * R - s / 2, s, s);
        }
        g.globalAlpha = 1;
        g.globalCompositeOperation = "source-over";
        return t < dur;
      },
    });
  }
}

function easeOut(p: number) {
  return 1 - Math.pow(1 - Math.min(1, p), 3);
}

function jagged(x1: number, y1: number, x2: number, y2: number, spread: number): number[] {
  const pts = [x1, y1];
  const rec = (ax: number, ay: number, bx: number, by: number, s: number, depth: number) => {
    if (depth === 0) {
      pts.push(bx, by);
      return;
    }
    const mx = (ax + bx) / 2 + (Math.random() - 0.5) * s;
    const my = (ay + by) / 2 + (Math.random() - 0.5) * s;
    rec(ax, ay, mx, my, s / 2, depth - 1);
    rec(mx, my, bx, by, s / 2, depth - 1);
  };
  rec(x1, y1, x2, y2, spread, 6);
  return pts;
}
