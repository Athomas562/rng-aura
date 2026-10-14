/**
 * Description déclarative de l'apparence d'une aura.
 * Chaque couche (`LayerSpec`) est rendue côté client par un renderer
 * enregistré dans `src/effects/registry.ts` : ajouter un effet revient à
 * ajouter un type ici et un renderer là-bas.
 */
export type ParticleKind =
  | "dust"
  | "ember"
  | "drop"
  | "leaf"
  | "bubble"
  | "snow"
  | "spark"
  | "petal"
  | "mist"
  | "shard"
  | "feather"
  | "star"
  | "glyph";

export type Motion = "rise" | "fall" | "orbit" | "drift" | "spiral-in" | "spiral-out";

export type LayerSpec =
  | { type: "halo"; intensity: number; pulse?: number }
  | {
      type: "particles";
      kind: ParticleKind;
      motion: Motion;
      count: number;
      size?: number;
      speed?: number;
      colors?: string[];
    }
  | { type: "rings"; count: number; speed: number; tilt?: number }
  | { type: "lightning"; rate: number }
  | { type: "rays"; count: number; speed: number }
  | { type: "starfield"; count: number }
  | { type: "void"; radius: number }
  | { type: "glitch"; rate: number };

export type SigilId =
  | "dot"
  | "ember"
  | "drop"
  | "swirl"
  | "bubble"
  | "crystal"
  | "gem"
  | "flame"
  | "wave"
  | "flower"
  | "nebula"
  | "prism"
  | "ghost"
  | "bolt"
  | "wing"
  | "abyss"
  | "sun"
  | "leaf"
  | "triad"
  | "eclipse"
  | "trident"
  | "halo"
  | "dawn"
  | "eye"
  | "constellation"
  | "nova"
  | "zenith"
  | "singularity"
  | "paradox"
  | "void"
  | "infinity"
  | "ouroboros";

export interface AuraVisual {
  primary: string;
  secondary: string;
  sigil: SigilId;
  /** Teinte qui tourne en continu (auras irisées). */
  hueShift?: boolean;
  layers: LayerSpec[];
}
