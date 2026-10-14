/**
 * Effets sonores synthétisés (WebAudio, aucun fichier à charger).
 * L'AudioContext n'est créé qu'après une interaction de l'utilisateur :
 * aucun son ne peut démarrer automatiquement.
 */
type Wave = OscillatorType;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;
  private volume = 0.5;

  constructor() {
    if (typeof window === "undefined") return;
    const unlock = () => {
      this.ensureContext();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
  }

  configure(enabled: boolean, volume: number) {
    this.enabled = enabled;
    this.volume = volume;
    if (this.master) this.master.gain.value = enabled ? volume * 0.6 : 0;
  }

  private ensureContext() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? this.volume * 0.6 : 0;
    this.master.connect(this.ctx.destination);
  }

  /** Contexte prêt à jouer, ou null si muet / pas encore d'interaction. */
  private ready(): AudioContext | null {
    if (!this.enabled || this.volume <= 0 || !this.ctx || !this.master) return null;
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, at: number, dur: number, type: Wave, gain: number, glideTo?: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + Math.min(0.02, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g).connect(this.master!);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  private noise(at: number, dur: number, gain: number, fromHz: number, toHz: number) {
    const ctx = this.ctx!;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(fromHz, at);
    filter.frequency.exponentialRampToValueAtTime(toHz, at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(filter).connect(g).connect(this.master!);
    src.start(at);
    src.stop(at + dur);
  }

  click() {
    const ctx = this.ready();
    if (!ctx) return;
    this.tone(520, ctx.currentTime, 0.06, "triangle", 0.12, 380);
  }

  /** Défilement des noms pendant le tirage. */
  tick() {
    const ctx = this.ready();
    if (!ctx) return;
    this.tone(1200 + Math.random() * 300, ctx.currentTime, 0.03, "square", 0.025);
  }

  /** Montée de tension avant une aura rare. */
  riser(durationMs: number) {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime;
    const d = durationMs / 1000;
    this.noise(t, d, 0.18, 200, 4000);
    this.tone(80, t, d, "sawtooth", 0.05, 320);
  }

  /** Son de découverte, de plus en plus riche selon le palier (0 → 9). */
  reveal(tier: number) {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime;
    const base = 440 * Math.pow(2, Math.min(tier, 6) / 12);
    if (tier <= 1) {
      this.tone(base * 1.5, t, 0.14, "sine", 0.14);
      if (tier === 1) this.tone(base * 2, t + 0.07, 0.16, "sine", 0.12);
      return;
    }
    const chord = [1, 1.25, 1.5, 2, 2.5, 3];
    const notes = Math.min(chord.length, 2 + tier);
    for (let i = 0; i < notes; i++) {
      this.tone(base * chord[i], t + i * 0.07, 0.5 + tier * 0.12, tier >= 5 ? "sawtooth" : "triangle", 0.09);
    }
    if (tier >= 3) this.noise(t, 0.6, 0.12, 6000, 1500);
    if (tier >= 4) {
      this.tone(110, t, 1.2, "sine", 0.35, 38);
      for (let i = 0; i < 6; i++) this.tone(base * 4 * (1 + i * 0.12), t + 0.3 + i * 0.09, 0.25, "sine", 0.04);
    }
    if (tier >= 7) {
      for (const detune of [0.995, 1, 1.006]) this.tone(base * detune, t + 0.4, 2.4, "sawtooth", 0.05);
      this.tone(55, t + 0.2, 2.5, "sine", 0.3, 30);
    }
  }

  potion() {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 5; i++) this.tone(300 + i * 140 + Math.random() * 60, t + i * 0.05, 0.1, "sine", 0.09);
  }

  achievement() {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, t + i * 0.09, 0.35, "triangle", 0.1));
  }

  error() {
    const ctx = this.ready();
    if (!ctx) return;
    this.tone(220, ctx.currentTime, 0.18, "square", 0.05, 150);
  }
}

export const sound = new SoundEngine();
