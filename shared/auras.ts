import { getEvent, isEventActive, type EventId } from "./events";
import type { RarityId } from "./rarities";
import type { AuraVisual } from "./visuals";

/** Effets joués pendant l'animation de découverte (cumulables). */
export type RevealFx =
  | "flash"
  | "shockwave"
  | "lightning"
  | "shake"
  | "distortion"
  | "warp"
  | "collapse"
  | "glitch"
  | "prismatic"
  /** Corruption : écran qui se déchire en blocs et décalages RVB. */
  | "corrupt"
  /** Création : la lumière naît du noir et s'assemble en anneau. */
  | "genesis"
  /** Rêve : flou et ondulations lentes. */
  | "dream"
  /** Aspiration : tout est attiré vers le centre avant l'apparition. */
  | "implode"
  /** Le nom se réarrange, illisible, avant de se fixer. */
  | "scramble";

/** Apparence alternative d'une aura (formes d'Écho, stades d'une aura vivante). */
export interface AuraForm {
  name: string;
  description?: string;
  visual: AuraVisual;
}

/**
 * Mécaniques spéciales. Toutes sont appliquées par le serveur (tirage, fusion,
 * malédiction) ; l'apparence (formes, stades, copie) est dérivée de l'état du joueur.
 */
export type AuraSpecial =
  /** Change de nom et d'apparence tous les `every` rolls du joueur. */
  | { kind: "echo"; every: number; forms: AuraForm[] }
  /** Copie l'apparence d'une autre aura possédée (choisie par le joueur). */
  | { kind: "mimic" }
  /** N'entre dans la table de tirage que pendant un événement. */
  | { kind: "seasonal"; event: EventId }
  /** Jamais tirée : obtenue en combinant des auras (consommées). */
  | { kind: "fusion"; ingredients: { auraId: string; count: number }[] }
  /** À l'obtention : bonus de chance temporaire, puis malus. */
  | { kind: "cursed"; boonLuck: number; boonMs: number; baneMul: number; baneMs: number }
  /** Évolue avec le nombre de rolls lancés depuis son obtention. */
  | { kind: "living"; stages: (AuraForm & { at: number })[] };

export type AuraSpecialKind = AuraSpecial["kind"];

export const SPECIAL_LABELS: Record<AuraSpecialKind, string> = {
  echo: "Changeante",
  mimic: "Mimétique",
  seasonal: "Saisonnière",
  fusion: "Fusion",
  cursed: "Maudite",
  living: "Vivante",
};

export interface Aura {
  id: string;
  name: string;
  rarity: RarityId;
  /** Chance de base « 1 sur N ». */
  odds: number;
  /**
   * Les auras « fallback » se partagent la probabilité restante une fois
   * toutes les autres servies (proportionnellement à 1/odds).
   */
  fallback?: boolean;
  description: string;
  reveal: RevealFx[];
  visual: AuraVisual;
  special?: AuraSpecial;
}

export const AURAS: readonly Aura[] = [
  // ───────────── Common ─────────────
  {
    id: "lueur",
    name: "Lueur",
    rarity: "common",
    odds: 2,
    fallback: true,
    description: "Une faible clarté qui accompagne chaque premier pas.",
    reveal: [],
    visual: {
      primary: "#d6e0ee",
      secondary: "#7d8ba1",
      sigil: "dot",
      layers: [
        { type: "halo", intensity: 0.35 },
        { type: "particles", kind: "dust", motion: "rise", count: 14 },
      ],
    },
  },
  {
    id: "cendre",
    name: "Cendre",
    rarity: "common",
    odds: 3,
    fallback: true,
    description: "Des braises éteintes qui refusent de retomber.",
    reveal: [],
    visual: {
      primary: "#a59a92",
      secondary: "#e0784a",
      sigil: "ember",
      layers: [
        { type: "halo", intensity: 0.3 },
        { type: "particles", kind: "ember", motion: "rise", count: 16, colors: ["#e0784a", "#8b817a"] },
      ],
    },
  },
  {
    id: "bruine",
    name: "Bruine",
    rarity: "common",
    odds: 4,
    fallback: true,
    description: "Un voile d'humidité tiède, presque imperceptible.",
    reveal: [],
    visual: {
      primary: "#a8cde0",
      secondary: "#5d7d94",
      sigil: "drop",
      layers: [
        { type: "halo", intensity: 0.3 },
        { type: "particles", kind: "drop", motion: "fall", count: 18 },
      ],
    },
  },
  // ───────────── Uncommon ─────────────
  {
    id: "brise",
    name: "Brise",
    rarity: "uncommon",
    odds: 8,
    description: "Un courant d'air qui tourne doucement autour de toi.",
    reveal: [],
    visual: {
      primary: "#7ff2c8",
      secondary: "#2fae86",
      sigil: "swirl",
      layers: [
        { type: "halo", intensity: 0.45 },
        { type: "particles", kind: "leaf", motion: "orbit", count: 14 },
      ],
    },
  },
  {
    id: "rosee",
    name: "Rosée",
    rarity: "uncommon",
    odds: 12,
    description: "Des perles d'eau suspendues qui captent la lumière de l'aube.",
    reveal: [],
    visual: {
      primary: "#9ef0ff",
      secondary: "#4aa8d8",
      sigil: "bubble",
      layers: [
        { type: "halo", intensity: 0.45 },
        { type: "particles", kind: "bubble", motion: "rise", count: 16 },
      ],
    },
  },
  {
    id: "givre",
    name: "Givre",
    rarity: "uncommon",
    odds: 18,
    description: "Un froid sec qui dessine des cristaux sur ta peau.",
    reveal: [],
    visual: {
      primary: "#d4f1ff",
      secondary: "#6fb6ff",
      sigil: "crystal",
      layers: [
        { type: "halo", intensity: 0.5 },
        { type: "particles", kind: "snow", motion: "fall", count: 22 },
      ],
    },
  },
  // ───────────── Rare ─────────────
  {
    id: "ambre",
    name: "Ambre",
    rarity: "rare",
    odds: 25,
    description: "Une résine dorée où le temps s'est figé.",
    reveal: ["flash"],
    visual: {
      primary: "#ffb347",
      secondary: "#c46a1b",
      sigil: "gem",
      layers: [
        { type: "halo", intensity: 0.6, pulse: 0.6 },
        { type: "particles", kind: "spark", motion: "drift", count: 20 },
      ],
    },
  },
  {
    id: "azur",
    name: "Azur",
    rarity: "rare",
    odds: 40,
    description: "Le bleu d'un ciel sans fin, condensé en une seule flamme.",
    reveal: ["flash"],
    visual: {
      primary: "#4cc3ff",
      secondary: "#1b5fd8",
      sigil: "flame",
      layers: [
        { type: "halo", intensity: 0.65 },
        { type: "particles", kind: "ember", motion: "rise", count: 28, colors: ["#4cc3ff", "#a8e6ff", "#1b5fd8"] },
      ],
    },
  },
  {
    id: "echo",
    name: "Écho",
    rarity: "rare",
    odds: 64,
    description: "Des ondes sonores devenues visibles.",
    reveal: ["flash", "shockwave"],
    visual: {
      primary: "#9be7ff",
      secondary: "#5a6cff",
      sigil: "wave",
      layers: [
        { type: "halo", intensity: 0.55 },
        { type: "rings", count: 3, speed: 0.6 },
      ],
    },
  },
  {
    id: "corail",
    name: "Corail",
    rarity: "rare",
    odds: 90,
    description: "Une floraison marine aux couleurs vives.",
    reveal: ["flash"],
    visual: {
      primary: "#ff7f9e",
      secondary: "#ff4d6d",
      sigil: "flower",
      layers: [
        { type: "halo", intensity: 0.6 },
        { type: "particles", kind: "petal", motion: "drift", count: 18 },
        { type: "particles", kind: "bubble", motion: "rise", count: 10, colors: ["#ffd1dc"] },
      ],
    },
  },
  // ───────────── Epic ─────────────
  {
    id: "nebuleuse",
    name: "Nébuleuse",
    rarity: "epic",
    odds: 150,
    description: "Un nuage de gaz stellaire en lente rotation.",
    reveal: ["flash", "shockwave"],
    visual: {
      primary: "#b072ff",
      secondary: "#ff6ad5",
      sigil: "nebula",
      layers: [
        { type: "halo", intensity: 0.8, pulse: 0.4 },
        { type: "particles", kind: "mist", motion: "orbit", count: 18 },
        { type: "particles", kind: "star", motion: "orbit", count: 14, size: 0.7 },
      ],
    },
  },
  {
    id: "prisme",
    name: "Prisme",
    rarity: "epic",
    odds: 300,
    description: "La lumière se brise et se recompose en arcs-en-ciel.",
    reveal: ["flash", "shockwave", "prismatic"],
    visual: {
      primary: "#ff9cf2",
      secondary: "#7af5ff",
      sigil: "prism",
      hueShift: true,
      layers: [
        { type: "halo", intensity: 0.7 },
        { type: "particles", kind: "shard", motion: "orbit", count: 18 },
        { type: "rays", count: 6, speed: 0.15 },
      ],
    },
  },
  {
    id: "spectre",
    name: "Spectre",
    rarity: "epic",
    odds: 550,
    description: "Une présence froide qui murmure des noms oubliés.",
    reveal: ["flash", "shockwave", "glitch"],
    visual: {
      primary: "#b8fff1",
      secondary: "#3d6b74",
      sigil: "ghost",
      layers: [
        { type: "halo", intensity: 0.6, pulse: 1.2 },
        { type: "particles", kind: "mist", motion: "rise", count: 24 },
        { type: "glitch", rate: 0.25 },
      ],
    },
  },
  {
    id: "orage",
    name: "Orage",
    rarity: "epic",
    odds: 850,
    description: "L'électricité crépite au rythme de ton cœur.",
    reveal: ["flash", "shockwave", "lightning"],
    visual: {
      primary: "#8fd3ff",
      secondary: "#3a46ff",
      sigil: "bolt",
      layers: [
        { type: "halo", intensity: 0.75 },
        { type: "particles", kind: "spark", motion: "drift", count: 22, colors: ["#e0f4ff", "#8fd3ff"] },
        { type: "lightning", rate: 0.6 },
      ],
    },
  },
  // ───────────── Legendary ─────────────
  {
    id: "phenix",
    name: "Phénix",
    rarity: "legendary",
    odds: 1_500,
    description: "Des flammes qui renaissent à chaque battement.",
    reveal: ["flash", "shockwave", "shake"],
    visual: {
      primary: "#ff8a3d",
      secondary: "#ff2e4d",
      sigil: "wing",
      layers: [
        { type: "halo", intensity: 0.95, pulse: 0.8 },
        { type: "particles", kind: "ember", motion: "rise", count: 48, colors: ["#ffd36b", "#ff8a3d", "#ff2e4d"] },
        { type: "particles", kind: "feather", motion: "fall", count: 8, colors: ["#ffb36b"] },
      ],
    },
  },
  {
    id: "abysse",
    name: "Abysse",
    rarity: "legendary",
    odds: 3_000,
    description: "Les profondeurs t'ont choisi. Elles ne te lâcheront plus.",
    reveal: ["flash", "shockwave", "distortion"],
    visual: {
      primary: "#2b6bff",
      secondary: "#06103a",
      sigil: "abyss",
      layers: [
        { type: "void", radius: 0.35 },
        { type: "halo", intensity: 0.7 },
        { type: "particles", kind: "bubble", motion: "spiral-in", count: 30, colors: ["#5f8dff", "#9fd0ff"] },
      ],
    },
  },
  {
    id: "solstice",
    name: "Solstice",
    rarity: "legendary",
    odds: 6_000,
    description: "Le jour le plus long, figé dans un halo d'or.",
    reveal: ["flash", "shockwave", "shake"],
    visual: {
      primary: "#ffd86b",
      secondary: "#ff9f1c",
      sigil: "sun",
      layers: [
        { type: "rays", count: 12, speed: 0.1 },
        { type: "halo", intensity: 1 },
        { type: "rings", count: 2, speed: 0.3 },
        { type: "particles", kind: "spark", motion: "orbit", count: 20 },
      ],
    },
  },
  {
    id: "sylve",
    name: "Sylve",
    rarity: "legendary",
    odds: 9_000,
    description: "L'esprit d'une forêt millénaire s'éveille autour de toi.",
    reveal: ["flash", "shockwave"],
    visual: {
      primary: "#7dff8a",
      secondary: "#1f8a4c",
      sigil: "leaf",
      layers: [
        { type: "halo", intensity: 0.85, pulse: 0.5 },
        { type: "particles", kind: "leaf", motion: "spiral-out", count: 36 },
        { type: "particles", kind: "spark", motion: "rise", count: 14, colors: ["#e8ffb0"] },
      ],
    },
  },
  // ───────────── Mythical ─────────────
  {
    id: "chimere",
    name: "Chimère",
    rarity: "mythical",
    odds: 15_000,
    description: "Trois natures, une seule aura. Aucune ne cède.",
    reveal: ["flash", "shockwave", "shake", "lightning"],
    visual: {
      primary: "#ff4d7e",
      secondary: "#4dffb8",
      sigil: "triad",
      layers: [
        { type: "halo", intensity: 1, pulse: 0.7 },
        { type: "particles", kind: "ember", motion: "rise", count: 24, colors: ["#ff4d7e"] },
        { type: "particles", kind: "snow", motion: "fall", count: 18, colors: ["#4dd2ff"] },
        { type: "particles", kind: "leaf", motion: "orbit", count: 16, colors: ["#4dffb8"] },
      ],
    },
  },
  {
    id: "eclipse",
    name: "Éclipse",
    rarity: "mythical",
    odds: 35_000,
    description: "Le soleil s'éteint. Seule sa couronne demeure.",
    reveal: ["flash", "shockwave", "distortion", "shake"],
    visual: {
      primary: "#ffeec2",
      secondary: "#ff7a1c",
      sigil: "eclipse",
      layers: [
        { type: "rays", count: 24, speed: 0.05 },
        { type: "halo", intensity: 1.1 },
        { type: "void", radius: 0.42 },
        { type: "rings", count: 1, speed: 0.2 },
      ],
    },
  },
  {
    id: "leviathan",
    name: "Léviathan",
    rarity: "mythical",
    odds: 70_000,
    description: "Les marées se plient sous un poids colossal.",
    reveal: ["flash", "shockwave", "lightning", "shake"],
    visual: {
      primary: "#00e0c6",
      secondary: "#004a6e",
      sigil: "trident",
      layers: [
        { type: "halo", intensity: 1, pulse: 0.5 },
        { type: "particles", kind: "drop", motion: "spiral-out", count: 44, colors: ["#00e0c6", "#a6fff2"] },
        { type: "lightning", rate: 0.5 },
        { type: "rings", count: 2, speed: 0.5, tilt: 0.5 },
      ],
    },
  },
  // ───────────── Divine ─────────────
  {
    id: "seraphin",
    name: "Séraphin",
    rarity: "divine",
    odds: 150_000,
    description: "Six ailes de lumière pure t'enveloppent.",
    reveal: ["flash", "shockwave", "shake", "warp"],
    visual: {
      primary: "#fff6c9",
      secondary: "#ffd36b",
      sigil: "halo",
      layers: [
        { type: "rays", count: 6, speed: 0.08 },
        { type: "halo", intensity: 1.2, pulse: 0.4 },
        { type: "rings", count: 3, speed: 0.25, tilt: 0.7 },
        { type: "particles", kind: "feather", motion: "fall", count: 30 },
      ],
    },
  },
  {
    id: "aurore",
    name: "Aurore sacrée",
    rarity: "divine",
    odds: 400_000,
    description: "Le premier rayon du monde, conservé pour toi seul.",
    reveal: ["flash", "shockwave", "warp", "prismatic"],
    visual: {
      primary: "#ffb3e6",
      secondary: "#7af5ff",
      sigil: "dawn",
      hueShift: true,
      layers: [
        { type: "rays", count: 16, speed: 0.12 },
        { type: "halo", intensity: 1.2 },
        { type: "particles", kind: "petal", motion: "spiral-out", count: 40, colors: ["#ffb3e6", "#fff2a8", "#7af5ff"] },
      ],
    },
  },
  {
    id: "oracle",
    name: "Oracle",
    rarity: "divine",
    odds: 800_000,
    description: "Des runes dansent et révèlent ce qui n'est pas encore arrivé.",
    reveal: ["flash", "shockwave", "distortion", "warp"],
    visual: {
      primary: "#c6a6ff",
      secondary: "#5b2bbf",
      sigil: "eye",
      layers: [
        { type: "halo", intensity: 1.1, pulse: 0.6 },
        { type: "rings", count: 3, speed: 0.4 },
        { type: "particles", kind: "glyph", motion: "orbit", count: 22 },
      ],
    },
  },
  // ───────────── Celestial ─────────────
  {
    id: "constellation",
    name: "Constellation",
    rarity: "celestial",
    odds: 1_500_000,
    description: "Les étoiles se relient pour dessiner ton nom.",
    reveal: ["flash", "shockwave", "warp", "shake", "lightning"],
    visual: {
      primary: "#7af5ff",
      secondary: "#2b3bff",
      sigil: "constellation",
      layers: [
        { type: "starfield", count: 90 },
        { type: "halo", intensity: 1.2 },
        { type: "particles", kind: "star", motion: "orbit", count: 40 },
        { type: "rings", count: 2, speed: 0.2, tilt: 0.6 },
      ],
    },
  },
  {
    id: "supernova",
    name: "Supernova",
    rarity: "celestial",
    odds: 4_000_000,
    description: "L'agonie d'une étoile, une fraction de seconde devenue éternelle.",
    reveal: ["flash", "shockwave", "warp", "shake", "distortion"],
    visual: {
      primary: "#ffe27a",
      secondary: "#ff3d7f",
      sigil: "nova",
      layers: [
        { type: "rays", count: 32, speed: 0.3 },
        { type: "halo", intensity: 1.4, pulse: 1 },
        { type: "particles", kind: "spark", motion: "spiral-out", count: 70, colors: ["#fff", "#ffe27a", "#ff3d7f"] },
        { type: "rings", count: 4, speed: 0.9 },
      ],
    },
  },
  {
    id: "zenith",
    name: "Zénith",
    rarity: "celestial",
    odds: 8_000_000,
    description: "Le point le plus haut du ciel. Il n'y a rien au-dessus.",
    reveal: ["flash", "shockwave", "warp", "lightning", "shake"],
    visual: {
      primary: "#ffffff",
      secondary: "#7a9bff",
      sigil: "zenith",
      layers: [
        { type: "starfield", count: 70 },
        { type: "rays", count: 8, speed: 0.06 },
        { type: "halo", intensity: 1.5 },
        { type: "lightning", rate: 0.4 },
        { type: "particles", kind: "star", motion: "rise", count: 40 },
      ],
    },
  },
  // ───────────── Transcendent ─────────────
  {
    id: "singularite",
    name: "Singularité",
    rarity: "transcendent",
    odds: 15_000_000,
    description: "La matière s'effondre. La lumière ne s'échappe plus.",
    reveal: ["flash", "collapse", "distortion", "shake", "warp"],
    visual: {
      primary: "#e3a6ff",
      secondary: "#14002e",
      sigil: "singularity",
      layers: [
        { type: "starfield", count: 80 },
        { type: "void", radius: 0.5 },
        { type: "rings", count: 5, speed: 1.2, tilt: 0.75 },
        { type: "particles", kind: "spark", motion: "spiral-in", count: 90, colors: ["#e3a6ff", "#ffffff", "#7a3bff"] },
      ],
    },
  },
  {
    id: "paradoxe",
    name: "Paradoxe",
    rarity: "transcendent",
    odds: 40_000_000,
    description: "Elle existe et n'existe pas. Les deux sont vrais.",
    reveal: ["flash", "glitch", "distortion", "shake", "lightning"],
    visual: {
      primary: "#00ffd5",
      secondary: "#ff00a8",
      sigil: "paradox",
      layers: [
        { type: "halo", intensity: 1.3, pulse: 1.5 },
        { type: "glitch", rate: 1 },
        { type: "particles", kind: "shard", motion: "spiral-in", count: 40 },
        { type: "particles", kind: "shard", motion: "spiral-out", count: 40, colors: ["#ff00a8"] },
        { type: "lightning", rate: 0.7 },
      ],
    },
  },
  {
    id: "neant",
    name: "Néant",
    rarity: "transcendent",
    odds: 75_000_000,
    description: "Ce qu'il y avait avant le tout premier roll.",
    reveal: ["collapse", "distortion", "warp", "shake"],
    visual: {
      primary: "#9c8cff",
      secondary: "#000000",
      sigil: "void",
      layers: [
        { type: "void", radius: 0.7 },
        { type: "rings", count: 3, speed: -0.5, tilt: 0.3 },
        { type: "particles", kind: "dust", motion: "spiral-in", count: 110, colors: ["#9c8cff", "#3b2b8f", "#ffffff"] },
      ],
    },
  },
  // ───────────── Infinity ─────────────
  {
    id: "infini",
    name: "Infini",
    rarity: "infinity",
    odds: 100_000_000,
    description: "Sans début, sans fin. Le compteur ne s'arrête jamais.",
    reveal: ["flash", "collapse", "shockwave", "warp", "shake", "lightning", "prismatic", "distortion"],
    visual: {
      primary: "#ffffff",
      secondary: "#ff4dff",
      sigil: "infinity",
      hueShift: true,
      layers: [
        { type: "starfield", count: 120 },
        { type: "rays", count: 36, speed: 0.25 },
        { type: "halo", intensity: 1.6, pulse: 0.8 },
        { type: "rings", count: 6, speed: 1, tilt: 0.7 },
        { type: "lightning", rate: 0.9 },
        { type: "particles", kind: "star", motion: "spiral-out", count: 90 },
      ],
    },
  },
  {
    id: "ouroboros",
    name: "Ouroboros",
    rarity: "infinity",
    odds: 250_000_000,
    description: "Le serpent qui se dévore lui-même, encore et encore, à l'infini.",
    reveal: ["flash", "collapse", "shockwave", "warp", "shake", "lightning", "glitch", "distortion"],
    visual: {
      primary: "#7dffb2",
      secondary: "#ffd36b",
      sigil: "ouroboros",
      hueShift: true,
      layers: [
        { type: "starfield", count: 120 },
        { type: "void", radius: 0.45 },
        { type: "rings", count: 7, speed: 1.4, tilt: 0.8 },
        { type: "halo", intensity: 1.6, pulse: 1 },
        { type: "particles", kind: "glyph", motion: "orbit", count: 40, colors: ["#7dffb2", "#ffd36b"] },
        { type: "particles", kind: "spark", motion: "spiral-in", count: 80 },
        { type: "lightning", rate: 0.8 },
      ],
    },
  },

  // ═════════════════════ Extension : nouvelles auras ═════════════════════

  // ───────────── Common ─────────────
  {
    id: "fumee",
    name: "Fumée",
    rarity: "common",
    odds: 2.5,
    fallback: true,
    description: "Une volute grise qui s'échappe d'un feu qu'on ne voit pas.",
    reveal: [],
    visual: {
      primary: "#b9b4c4",
      secondary: "#5f5a6e",
      sigil: "smoke",
      layers: [
        { type: "halo", intensity: 0.28 },
        { type: "particles", kind: "mist", motion: "rise", count: 12 },
      ],
    },
  },
  {
    id: "murmure",
    name: "Murmure",
    rarity: "common",
    odds: 4.5,
    fallback: true,
    description: "Des mots trop bas pour être compris tournent autour de toi.",
    reveal: [],
    visual: {
      primary: "#c9b8ff",
      secondary: "#6c5ca8",
      sigil: "whisper",
      layers: [
        { type: "halo", intensity: 0.32 },
        { type: "particles", kind: "dust", motion: "orbit", count: 14 },
      ],
    },
  },
  // ───────────── Uncommon ─────────────
  {
    id: "luciole",
    name: "Luciole",
    rarity: "uncommon",
    odds: 19,
    description: "Une nuée de petites lumières qui clignotent au rythme de ton cœur.",
    reveal: [],
    visual: {
      primary: "#e6ff6b",
      secondary: "#5fae2f",
      sigil: "firefly",
      layers: [
        { type: "halo", intensity: 0.45, pulse: 0.9 },
        { type: "particles", kind: "dust", motion: "drift", count: 20, colors: ["#e6ff6b", "#b6ff4d"] },
      ],
    },
  },
  // ───────────── Rare ─────────────
  {
    id: "mirage",
    name: "Mirage",
    rarity: "rare",
    odds: 55,
    description: "L'air ondule comme au-dessus d'un désert brûlant.",
    reveal: ["flash"],
    visual: {
      primary: "#ffcf87",
      secondary: "#d27a3a",
      sigil: "dune",
      layers: [
        { type: "halo", intensity: 0.55 },
        { type: "ripple", count: 2, speed: 0.4 },
        { type: "particles", kind: "dust", motion: "drift", count: 22, colors: ["#ffcf87", "#e8a35c"] },
      ],
    },
  },
  {
    id: "maree",
    name: "Marée",
    rarity: "rare",
    odds: 75,
    description: "Le ressac d'un océan invisible vient lécher tes pieds.",
    reveal: ["flash", "shockwave"],
    visual: {
      primary: "#4de0ff",
      secondary: "#1a6fd8",
      sigil: "tide",
      layers: [
        { type: "halo", intensity: 0.6 },
        { type: "rings", count: 2, speed: 0.5, tilt: 0.7 },
        { type: "particles", kind: "drop", motion: "rise", count: 18 },
      ],
    },
  },
  {
    id: "ronce",
    name: "Ronce",
    rarity: "rare",
    odds: 99,
    description: "Des épines sombres poussent et se rétractent autour de toi.",
    reveal: ["flash"],
    visual: {
      primary: "#6bd17a",
      secondary: "#2a4d2e",
      sigil: "thorn",
      layers: [
        { type: "halo", intensity: 0.5 },
        { type: "particles", kind: "shard", motion: "orbit", count: 16, colors: ["#3c7a45", "#9be3a4"] },
      ],
    },
  },
  // ───────────── Epic ─────────────
  {
    id: "boreale",
    name: "Boréale",
    rarity: "epic",
    odds: 200,
    description: "Des rideaux de lumière verte et violette ondulent dans ton dos.",
    reveal: ["flash", "shockwave", "prismatic"],
    visual: {
      primary: "#6bffc4",
      secondary: "#9b5cff",
      sigil: "aurora",
      layers: [
        { type: "rays", count: 5, speed: 0.06 },
        { type: "halo", intensity: 0.75, pulse: 0.3 },
        { type: "particles", kind: "mist", motion: "drift", count: 16, colors: ["#6bffc4", "#9b5cff"] },
      ],
    },
  },
  {
    id: "selene",
    name: "Sélène",
    rarity: "epic",
    odds: 400,
    description: "Le reflet froid de la lune, et la neige qui tombe sans bruit.",
    reveal: ["flash", "shockwave"],
    visual: {
      primary: "#dfe9ff",
      secondary: "#6f86c9",
      sigil: "moon",
      layers: [
        { type: "halo", intensity: 0.8 },
        { type: "rings", count: 1, speed: 0.15 },
        { type: "particles", kind: "snow", motion: "fall", count: 24, colors: ["#ffffff", "#c5d6ff"] },
      ],
    },
  },
  {
    id: "echo_fractal",
    name: "Écho fractal",
    rarity: "epic",
    odds: 650,
    description: "Une aura instable qui change de forme tous les 100 rolls.",
    reveal: ["flash", "shockwave", "glitch"],
    special: {
      kind: "echo",
      every: 100,
      forms: [
        {
          name: "Écho de cristal",
          description: "L'écho s'est figé en cristaux qui tintent.",
          visual: {
            primary: "#a8f0ff",
            secondary: "#3a8fd8",
            sigil: "crystal",
            layers: [
              { type: "halo", intensity: 0.7 },
              { type: "particles", kind: "shard", motion: "orbit", count: 20, colors: ["#a8f0ff", "#ffffff"] },
            ],
          },
        },
        {
          name: "Écho de braise",
          description: "L'écho brûle doucement, prêt à changer encore.",
          visual: {
            primary: "#ff9a5c",
            secondary: "#b8321f",
            sigil: "flame",
            layers: [
              { type: "halo", intensity: 0.75, pulse: 0.8 },
              { type: "particles", kind: "ember", motion: "rise", count: 30 },
            ],
          },
        },
        {
          name: "Écho d'onde",
          description: "L'écho se propage en cercles, comme un son dans l'eau.",
          visual: {
            primary: "#7affd8",
            secondary: "#1f8f8a",
            sigil: "wave",
            layers: [
              { type: "halo", intensity: 0.6 },
              { type: "ripple", count: 3, speed: 0.6 },
              { type: "rings", count: 2, speed: 0.4 },
            ],
          },
        },
        {
          name: "Écho d'ombre",
          description: "L'écho s'est fait silence et obscurité.",
          visual: {
            primary: "#b49cff",
            secondary: "#2b1f5c",
            sigil: "ghost",
            layers: [
              { type: "void", radius: 0.3 },
              { type: "halo", intensity: 0.55 },
              { type: "particles", kind: "mist", motion: "spiral-in", count: 20 },
            ],
          },
        },
        {
          name: "Écho d'étoile",
          description: "L'écho scintille, dispersé en mille points de lumière.",
          visual: {
            primary: "#fff3a8",
            secondary: "#d8a33a",
            sigil: "nova",
            layers: [
              { type: "halo", intensity: 0.8 },
              { type: "particles", kind: "star", motion: "orbit", count: 22 },
            ],
          },
        },
      ],
    },
    visual: {
      primary: "#a8f0ff",
      secondary: "#3a8fd8",
      sigil: "crystal",
      layers: [
        { type: "halo", intensity: 0.7 },
        { type: "particles", kind: "shard", motion: "orbit", count: 20, colors: ["#a8f0ff", "#ffffff"] },
      ],
    },
  },
  {
    id: "venin",
    name: "Venin",
    rarity: "epic",
    odds: 950,
    description: "Des bulles toxiques éclatent avec un sifflement inquiétant.",
    reveal: ["flash", "shockwave", "distortion"],
    visual: {
      primary: "#8dff4d",
      secondary: "#4b1f7a",
      sigil: "venom",
      layers: [
        { type: "halo", intensity: 0.7, pulse: 1.1 },
        { type: "particles", kind: "bubble", motion: "rise", count: 26, colors: ["#8dff4d", "#c46bff"] },
        { type: "glitch", rate: 0.12 },
      ],
    },
  },
  // ───────────── Legendary ─────────────
  {
    id: "valkyrie",
    name: "Valkyrie",
    rarity: "legendary",
    odds: 2_000,
    description: "Des ailes d'acier lumineux se déploient pour t'emporter au combat.",
    reveal: ["flash", "shockwave", "shake"],
    visual: {
      primary: "#e8f1ff",
      secondary: "#5d8bff",
      sigil: "valkyrie",
      layers: [
        { type: "rays", count: 10, speed: 0.12 },
        { type: "halo", intensity: 0.95 },
        { type: "particles", kind: "feather", motion: "spiral-out", count: 26, colors: ["#e8f1ff", "#a9c4ff"] },
      ],
    },
  },
  {
    id: "kraken",
    name: "Kraken",
    rarity: "legendary",
    odds: 4_500,
    description: "Des tentacules d'encre remontent des profondeurs pour t'entourer.",
    reveal: ["flash", "shockwave", "distortion", "shake"],
    visual: {
      primary: "#3dd6c2",
      secondary: "#14254f",
      sigil: "tentacle",
      layers: [
        { type: "void", radius: 0.3 },
        { type: "halo", intensity: 0.8 },
        { type: "particles", kind: "drop", motion: "spiral-in", count: 34, colors: ["#3dd6c2", "#1f5f8f"] },
        { type: "ripple", count: 2, speed: 0.3 },
      ],
    },
  },
  {
    id: "mimique",
    name: "Mimique",
    rarity: "legendary",
    odds: 7_500,
    description: "Une aura sans visage qui copie l'apparence d'une autre aura que tu possèdes.",
    reveal: ["flash", "shockwave", "glitch"],
    special: { kind: "mimic" },
    visual: {
      primary: "#d7d7e6",
      secondary: "#4a4a63",
      sigil: "mask",
      layers: [
        { type: "halo", intensity: 0.75, pulse: 0.6 },
        { type: "particles", kind: "mist", motion: "orbit", count: 18 },
        { type: "glitch", rate: 0.2 },
      ],
    },
  },
  {
    id: "yggdrasil",
    name: "Yggdrasil",
    rarity: "legendary",
    odds: 8_500,
    description: "Une graine vivante. Plus tu lances de rolls, plus elle grandit, jusqu'à devenir l'arbre-monde.",
    reveal: ["flash", "shockwave"],
    special: {
      kind: "living",
      stages: [
        {
          at: 0,
          name: "Yggdrasil · Graine",
          description: "Une graine qui pulse doucement. Elle attend que tu lances des rolls.",
          visual: {
            primary: "#b5e86b",
            secondary: "#5a3d1f",
            sigil: "seed",
            layers: [
              { type: "halo", intensity: 0.5, pulse: 0.5 },
              { type: "particles", kind: "dust", motion: "rise", count: 10, colors: ["#d8ff9c"] },
            ],
          },
        },
        {
          at: 1_000,
          name: "Yggdrasil · Pousse",
          description: "Les premières feuilles sont sorties.",
          visual: {
            primary: "#8fe86b",
            secondary: "#3d7a2a",
            sigil: "sprout",
            layers: [
              { type: "halo", intensity: 0.65, pulse: 0.5 },
              { type: "particles", kind: "leaf", motion: "rise", count: 16 },
            ],
          },
        },
        {
          at: 5_000,
          name: "Yggdrasil · Arbuste",
          description: "Ses branches commencent à t'entourer.",
          visual: {
            primary: "#6bdc5a",
            secondary: "#2a6b2f",
            sigil: "leaf",
            layers: [
              { type: "halo", intensity: 0.8, pulse: 0.4 },
              { type: "particles", kind: "leaf", motion: "orbit", count: 24 },
              { type: "particles", kind: "spark", motion: "rise", count: 10, colors: ["#e8ffb0"] },
            ],
          },
        },
        {
          at: 20_000,
          name: "Yggdrasil · Grand arbre",
          description: "Un arbre immense, dont les racines touchent d'autres mondes.",
          visual: {
            primary: "#5affb0",
            secondary: "#1f7a4d",
            sigil: "tree",
            layers: [
              { type: "rays", count: 8, speed: 0.05 },
              { type: "halo", intensity: 1 },
              { type: "particles", kind: "leaf", motion: "spiral-out", count: 34 },
              { type: "rings", count: 2, speed: 0.2, tilt: 0.6 },
            ],
          },
        },
        {
          at: 50_000,
          name: "Yggdrasil · Arbre-monde",
          description: "L'arbre-monde porte les neuf royaumes dans ses branches.",
          visual: {
            primary: "#a6ffcf",
            secondary: "#ffd36b",
            sigil: "tree",
            hueShift: true,
            layers: [
              { type: "starfield", count: 60 },
              { type: "rays", count: 9, speed: 0.08 },
              { type: "halo", intensity: 1.3, pulse: 0.4 },
              { type: "rings", count: 3, speed: 0.3, tilt: 0.7 },
              { type: "particles", kind: "leaf", motion: "spiral-out", count: 40, colors: ["#a6ffcf", "#ffd36b"] },
              { type: "particles", kind: "glyph", motion: "orbit", count: 14, colors: ["#ffd36b"] },
            ],
          },
        },
      ],
    },
    visual: {
      primary: "#b5e86b",
      secondary: "#5a3d1f",
      sigil: "seed",
      layers: [
        { type: "halo", intensity: 0.5, pulse: 0.5 },
        { type: "particles", kind: "dust", motion: "rise", count: 10, colors: ["#d8ff9c"] },
      ],
    },
  },
  // ───────────── Mythical ─────────────
  {
    id: "hydre",
    name: "Hydre",
    rarity: "mythical",
    odds: 20_000,
    description: "Trois têtes de lumière sifflent autour de toi ; coupe-en une, deux repoussent.",
    reveal: ["flash", "shockwave", "lightning", "shake"],
    visual: {
      primary: "#6bff9e",
      secondary: "#7a2fff",
      sigil: "hydra",
      layers: [
        { type: "halo", intensity: 1, pulse: 0.6 },
        { type: "particles", kind: "spark", motion: "spiral-out", count: 40, colors: ["#6bff9e", "#c08bff"] },
        { type: "lightning", rate: 0.4 },
      ],
    },
  },
  {
    id: "maudite",
    name: "Marque maudite",
    rarity: "mythical",
    odds: 25_000,
    description: "À l'obtention : +300 % de chance pendant 90 s… puis chance divisée par 2 pendant 60 s.",
    reveal: ["flash", "shockwave", "distortion", "glitch"],
    special: { kind: "cursed", boonLuck: 3, boonMs: 90_000, baneMul: 0.5, baneMs: 60_000 },
    visual: {
      primary: "#ff3d5a",
      secondary: "#1a0008",
      sigil: "curse",
      layers: [
        { type: "void", radius: 0.32 },
        { type: "halo", intensity: 0.9, pulse: 1.4 },
        { type: "particles", kind: "glyph", motion: "spiral-in", count: 26, colors: ["#ff3d5a", "#8a0018"] },
        { type: "glitch", rate: 0.25 },
      ],
    },
  },
  {
    id: "nocturne",
    name: "Nocturne",
    rarity: "mythical",
    odds: 45_000,
    description: "La nuit elle-même s'enroule autour de toi, piquée d'étoiles.",
    reveal: ["flash", "shockwave", "warp", "shake"],
    visual: {
      primary: "#7a9bff",
      secondary: "#0c1240",
      sigil: "crescent",
      layers: [
        { type: "starfield", count: 50 },
        { type: "void", radius: 0.28 },
        { type: "halo", intensity: 0.9 },
        { type: "particles", kind: "star", motion: "orbit", count: 26 },
      ],
    },
  },
  // ───────────── Corrupted (branche) ─────────────
  {
    id: "erreur",
    name: "Erreur 404",
    rarity: "corrupted",
    odds: 55_555,
    description: "Aura introuvable. Elle n'aurait jamais dû exister.",
    reveal: ["corrupt", "glitch", "shake", "distortion"],
    visual: {
      primary: "#39ff88",
      secondary: "#ff2e88",
      sigil: "error",
      layers: [
        { type: "halo", intensity: 0.85, pulse: 2 },
        { type: "particles", kind: "bit", motion: "drift", count: 40, colors: ["#39ff88", "#ff2e88", "#ffffff"] },
        { type: "glitch", rate: 0.9 },
      ],
    },
  },
  {
    id: "pixel_mort",
    name: "Pixel mort",
    rarity: "corrupted",
    odds: 66_666,
    description: "Un carré de l'écran a cessé de fonctionner. Il te suit.",
    reveal: ["corrupt", "glitch", "collapse"],
    visual: {
      primary: "#ff2e88",
      secondary: "#1affd5",
      sigil: "pixel",
      layers: [
        { type: "void", radius: 0.25 },
        { type: "particles", kind: "bit", motion: "spiral-in", count: 46, colors: ["#ff2e88", "#1affd5"] },
        { type: "glitch", rate: 1.1 },
      ],
    },
  },
  {
    id: "virus",
    name: "Virus",
    rarity: "corrupted",
    odds: 88_888,
    description: "Une infection lumineuse qui réécrit tout ce qu'elle touche.",
    reveal: ["corrupt", "glitch", "lightning", "shake"],
    visual: {
      primary: "#b6ff1a",
      secondary: "#003b1f",
      sigil: "virus",
      layers: [
        { type: "halo", intensity: 1, pulse: 1.6 },
        { type: "rings", count: 3, speed: 1.4 },
        { type: "particles", kind: "bit", motion: "spiral-out", count: 54, colors: ["#b6ff1a", "#39ff88"] },
        { type: "glitch", rate: 0.8 },
        { type: "lightning", rate: 0.3 },
      ],
    },
  },
  // ───────────── Divine ─────────────
  {
    id: "archange",
    name: "Archange",
    rarity: "divine",
    odds: 250_000,
    description: "Six ailes de lumière pure et un chœur que toi seul entends.",
    reveal: ["flash", "shockwave", "shake", "warp"],
    visual: {
      primary: "#fff6d6",
      secondary: "#ffbf3d",
      sigil: "wing",
      layers: [
        { type: "rays", count: 12, speed: 0.07 },
        { type: "halo", intensity: 1.3, pulse: 0.4 },
        { type: "rings", count: 2, speed: 0.2, tilt: 0.8 },
        { type: "particles", kind: "feather", motion: "spiral-out", count: 40, colors: ["#ffffff", "#ffe39c"] },
      ],
    },
  },
  {
    id: "lotus",
    name: "Lotus sacré",
    rarity: "divine",
    odds: 600_000,
    description: "Une fleur de lumière s'ouvre sous tes pieds, pétale après pétale.",
    reveal: ["flash", "shockwave", "warp", "prismatic"],
    visual: {
      primary: "#ffc2ec",
      secondary: "#ff6bc4",
      sigil: "lotus",
      layers: [
        { type: "halo", intensity: 1.2 },
        { type: "ripple", count: 2, speed: 0.3 },
        { type: "particles", kind: "petal", motion: "spiral-out", count: 44, colors: ["#ffc2ec", "#ffffff", "#ff8ad8"] },
      ],
    },
  },
  // ───────────── Celestial ─────────────
  {
    id: "comete",
    name: "Comète",
    rarity: "celestial",
    odds: 2_500_000,
    description: "Une traînée de feu stellaire qui ne repasse qu'une fois par millénaire.",
    reveal: ["flash", "shockwave", "warp", "shake", "lightning"],
    visual: {
      primary: "#9fe8ff",
      secondary: "#ff7a3d",
      sigil: "comet",
      layers: [
        { type: "starfield", count: 70 },
        { type: "halo", intensity: 1.3 },
        { type: "particles", kind: "spark", motion: "orbit", count: 50, colors: ["#9fe8ff", "#ffffff", "#ff9a5c"] },
        { type: "rings", count: 1, speed: 1.2, tilt: 0.8 },
      ],
    },
  },
  {
    id: "galaxie",
    name: "Galaxie",
    rarity: "celestial",
    odds: 6_000_000,
    description: "Cent milliards d'étoiles tournent lentement autour de toi.",
    reveal: ["flash", "shockwave", "warp", "distortion", "shake"],
    visual: {
      primary: "#c49bff",
      secondary: "#3dc8ff",
      sigil: "galaxy",
      hueShift: true,
      layers: [
        { type: "starfield", count: 110 },
        { type: "halo", intensity: 1.3, pulse: 0.3 },
        { type: "particles", kind: "star", motion: "spiral-in", count: 70 },
        { type: "particles", kind: "mist", motion: "orbit", count: 20 },
      ],
    },
  },
  // ───────────── Primordial (branche) ─────────────
  {
    id: "genese",
    name: "Genèse",
    rarity: "primordial",
    odds: 5_500_000,
    description: "La toute première lumière, celle qui a précédé le monde.",
    reveal: ["genesis", "flash", "shockwave", "warp"],
    visual: {
      primary: "#ffe2a8",
      secondary: "#ff7a1a",
      sigil: "genesis",
      layers: [
        { type: "rays", count: 20, speed: 0.04 },
        { type: "halo", intensity: 1.5, pulse: 0.5 },
        { type: "rings", count: 4, speed: 0.4, tilt: 0.6 },
        { type: "particles", kind: "spark", motion: "spiral-in", count: 70, colors: ["#ffe2a8", "#ffffff", "#ff9d3d"] },
      ],
    },
  },
  {
    id: "chaos",
    name: "Chaos originel",
    rarity: "primordial",
    odds: 7_777_777,
    description: "Le désordre d'avant les formes, qui bout encore autour de toi.",
    reveal: ["genesis", "shockwave", "lightning", "shake", "distortion"],
    visual: {
      primary: "#ff5c3d",
      secondary: "#3d0aff",
      sigil: "chaos",
      layers: [
        { type: "halo", intensity: 1.4, pulse: 1.2 },
        { type: "particles", kind: "shard", motion: "spiral-out", count: 50, colors: ["#ff5c3d", "#ffd36b"] },
        { type: "particles", kind: "shard", motion: "spiral-in", count: 40, colors: ["#3d0aff", "#b49cff"] },
        { type: "lightning", rate: 0.8 },
      ],
    },
  },
  {
    id: "souffle",
    name: "Premier souffle",
    rarity: "primordial",
    odds: 9_000_000,
    description: "Le vent qui a soufflé sur le vide et l'a rempli de vie.",
    reveal: ["genesis", "flash", "warp", "prismatic"],
    visual: {
      primary: "#d6fff4",
      secondary: "#4dffd2",
      sigil: "breath",
      hueShift: true,
      layers: [
        { type: "rays", count: 14, speed: 0.1 },
        { type: "halo", intensity: 1.4 },
        { type: "particles", kind: "mist", motion: "spiral-out", count: 30 },
        { type: "particles", kind: "leaf", motion: "spiral-out", count: 30, colors: ["#d6fff4", "#7affd8"] },
      ],
    },
  },
  // ───────────── Transcendent ─────────────
  {
    id: "ether",
    name: "Éther",
    rarity: "transcendent",
    odds: 30_000_000,
    description: "La substance des dieux, ni matière ni lumière.",
    reveal: ["flash", "collapse", "warp", "prismatic", "shake"],
    visual: {
      primary: "#f0d6ff",
      secondary: "#6bf0ff",
      sigil: "ether",
      hueShift: true,
      layers: [
        { type: "starfield", count: 80 },
        { type: "rays", count: 6, speed: 0.2 },
        { type: "halo", intensity: 1.5, pulse: 0.6 },
        { type: "rings", count: 5, speed: 0.7, tilt: 0.7 },
        { type: "particles", kind: "shard", motion: "orbit", count: 50, colors: ["#f0d6ff", "#6bf0ff"] },
      ],
    },
  },
  // ───────────── Dream (branche) ─────────────
  {
    id: "reverie",
    name: "Rêverie",
    rarity: "dream",
    odds: 22_000_000,
    description: "Tu ne sais plus si tu es éveillé. Tout est doux et flou.",
    reveal: ["dream", "flash", "distortion"],
    visual: {
      primary: "#ffc6f2",
      secondary: "#9bb8ff",
      sigil: "dream",
      layers: [
        { type: "ripple", count: 4, speed: 0.25 },
        { type: "halo", intensity: 1.3, pulse: 0.3 },
        { type: "particles", kind: "bubble", motion: "rise", count: 40, colors: ["#ffc6f2", "#c6d6ff"] },
        { type: "particles", kind: "mist", motion: "drift", count: 20 },
      ],
    },
  },
  {
    id: "songe",
    name: "Songe lucide",
    rarity: "dream",
    odds: 45_000_000,
    description: "Tu rêves, et tu le sais. Le rêve t'obéit.",
    reveal: ["dream", "warp", "prismatic", "distortion"],
    visual: {
      primary: "#b8a6ff",
      secondary: "#ffd1f6",
      sigil: "lucid",
      hueShift: true,
      layers: [
        { type: "starfield", count: 70 },
        { type: "ripple", count: 3, speed: 0.35 },
        { type: "halo", intensity: 1.4 },
        { type: "particles", kind: "star", motion: "orbit", count: 40 },
        { type: "particles", kind: "bubble", motion: "spiral-out", count: 26 },
      ],
    },
  },
  {
    id: "cauchemar",
    name: "Cauchemar",
    rarity: "dream",
    odds: 80_000_000,
    description: "Le rêve a mal tourné. Quelque chose te regarde depuis le flou.",
    reveal: ["dream", "glitch", "collapse", "distortion", "shake"],
    visual: {
      primary: "#ff4d9e",
      secondary: "#14001f",
      sigil: "nightmare",
      layers: [
        { type: "void", radius: 0.5 },
        { type: "ripple", count: 4, speed: -0.3 },
        { type: "halo", intensity: 1.2, pulse: 1.4 },
        { type: "particles", kind: "mist", motion: "spiral-in", count: 40, colors: ["#ff4d9e", "#5c0a7a"] },
        { type: "glitch", rate: 0.5 },
      ],
    },
  },
  // ───────────── Infinity ─────────────
  {
    id: "eternite",
    name: "Éternité",
    rarity: "infinity",
    odds: 150_000_000,
    description: "Un instant qui ne finit jamais, gravé dans des anneaux de lumière.",
    reveal: ["flash", "collapse", "shockwave", "warp", "shake", "prismatic", "distortion"],
    visual: {
      primary: "#fffbe6",
      secondary: "#8fd3ff",
      sigil: "eternity",
      hueShift: true,
      layers: [
        { type: "starfield", count: 120 },
        { type: "rays", count: 24, speed: 0.15 },
        { type: "halo", intensity: 1.6, pulse: 0.5 },
        { type: "rings", count: 7, speed: 0.6, tilt: 0.8 },
        { type: "particles", kind: "glyph", motion: "orbit", count: 36 },
        { type: "particles", kind: "star", motion: "spiral-out", count: 70 },
      ],
    },
  },
  // ───────────── Void ─────────────
  {
    id: "trou_noir",
    name: "Trou noir",
    rarity: "void",
    odds: 600_000_000,
    description: "Rien ne s'en échappe. Pas même la lumière. Pas même toi.",
    reveal: ["implode", "collapse", "distortion", "shake", "warp"],
    visual: {
      primary: "#8c7bff",
      secondary: "#ff9d3d",
      sigil: "blackhole",
      layers: [
        { type: "starfield", count: 120 },
        { type: "void", radius: 0.85 },
        { type: "rings", count: 4, speed: 1.6, tilt: 0.85 },
        { type: "particles", kind: "spark", motion: "spiral-in", count: 120, colors: ["#ff9d3d", "#ffffff", "#8c7bff"] },
      ],
    },
  },
  {
    id: "horizon",
    name: "Horizon des événements",
    rarity: "void",
    odds: 850_000_000,
    description: "La frontière au-delà de laquelle le temps cesse de couler.",
    reveal: ["implode", "collapse", "distortion", "warp", "shake", "glitch"],
    visual: {
      primary: "#b4a6ff",
      secondary: "#000000",
      sigil: "horizon",
      layers: [
        { type: "starfield", count: 140 },
        { type: "void", radius: 1 },
        { type: "ripple", count: 3, speed: -0.6 },
        { type: "rings", count: 2, speed: -0.4, tilt: 0.2 },
        { type: "particles", kind: "dust", motion: "spiral-in", count: 140, colors: ["#b4a6ff", "#ffffff"] },
      ],
    },
  },
  // ───────────── Beyond ─────────────
  {
    id: "inconnu",
    name: "L'Inconnu",
    rarity: "beyond",
    odds: 1_000_000_000,
    description: "Il n'existe aucun mot pour le décrire. Ceux qui ont essayé ont oublié leur nom.",
    reveal: ["scramble", "implode", "glitch", "distortion", "shake", "collapse"],
    visual: {
      primary: "#ffffff",
      secondary: "#2a2a2a",
      sigil: "unknown",
      layers: [
        { type: "starfield", count: 100 },
        { type: "void", radius: 0.6 },
        { type: "halo", intensity: 1.2, pulse: 2 },
        { type: "particles", kind: "glyph", motion: "spiral-in", count: 60, colors: ["#ffffff", "#9a9a9a"] },
        { type: "glitch", rate: 1.2 },
      ],
    },
  },
  {
    id: "omega",
    name: "Oméga",
    rarity: "beyond",
    odds: 2_000_000_000,
    description: "La dernière lettre. La fin de toute chose, et ce qui vient après.",
    reveal: ["scramble", "implode", "flash", "collapse", "shockwave", "warp", "shake", "lightning", "prismatic", "distortion"],
    visual: {
      primary: "#ffffff",
      secondary: "#ff3d7f",
      sigil: "omega",
      hueShift: true,
      layers: [
        { type: "starfield", count: 150 },
        { type: "void", radius: 0.5 },
        { type: "rays", count: 40, speed: 0.3 },
        { type: "halo", intensity: 1.7, pulse: 0.9 },
        { type: "rings", count: 8, speed: 1.2, tilt: 0.8 },
        { type: "ripple", count: 3, speed: 0.8 },
        { type: "particles", kind: "glyph", motion: "orbit", count: 40 },
        { type: "particles", kind: "star", motion: "spiral-out", count: 90 },
        { type: "lightning", rate: 1 },
      ],
    },
  },

  // ───────────── Saisonnières (événements) ─────────────
  {
    id: "citrouille",
    name: "Citrouille spectrale",
    rarity: "epic",
    odds: 666,
    description: "Exclusive à la Nuit des Spectres. Un rire creux résonne derrière toi.",
    reveal: ["flash", "shockwave", "glitch"],
    special: { kind: "seasonal", event: "halloween" },
    visual: {
      primary: "#ff8a1f",
      secondary: "#5c1fa8",
      sigil: "pumpkin",
      layers: [
        { type: "halo", intensity: 0.8, pulse: 1 },
        { type: "particles", kind: "ember", motion: "rise", count: 26, colors: ["#ff8a1f", "#ffcf3d"] },
        { type: "particles", kind: "mist", motion: "orbit", count: 14, colors: ["#8a3dff"] },
      ],
    },
  },
  {
    id: "flocon_royal",
    name: "Flocon royal",
    rarity: "legendary",
    odds: 3_333,
    description: "Exclusive au Solstice d'hiver. Aucun flocon n'est pareil ; celui-ci est roi.",
    reveal: ["flash", "shockwave", "shake"],
    special: { kind: "seasonal", event: "winter" },
    visual: {
      primary: "#e6f7ff",
      secondary: "#5cb8ff",
      sigil: "snowflake",
      layers: [
        { type: "rays", count: 6, speed: 0.05 },
        { type: "halo", intensity: 0.95 },
        { type: "particles", kind: "snow", motion: "spiral-out", count: 40 },
      ],
    },
  },
  {
    id: "floraison",
    name: "Floraison",
    rarity: "epic",
    odds: 444,
    description: "Exclusive à l'Éveil du printemps. Des fleurs naissent à chacun de tes pas.",
    reveal: ["flash", "shockwave", "prismatic"],
    special: { kind: "seasonal", event: "spring" },
    visual: {
      primary: "#ff9ed8",
      secondary: "#7ae86b",
      sigil: "bloom",
      layers: [
        { type: "halo", intensity: 0.75 },
        { type: "particles", kind: "petal", motion: "spiral-out", count: 30, colors: ["#ff9ed8", "#fff2a8", "#ffffff"] },
        { type: "particles", kind: "leaf", motion: "orbit", count: 10, colors: ["#7ae86b"] },
      ],
    },
  },
  {
    id: "soleil_minuit",
    name: "Soleil de minuit",
    rarity: "legendary",
    odds: 5_000,
    description: "Exclusive aux Nuits d'été. Un soleil pâle qui refuse de se coucher.",
    reveal: ["flash", "shockwave", "shake"],
    special: { kind: "seasonal", event: "summer" },
    visual: {
      primary: "#ffd36b",
      secondary: "#ff5c8a",
      sigil: "midnight",
      layers: [
        { type: "rays", count: 16, speed: 0.08 },
        { type: "halo", intensity: 1 },
        { type: "particles", kind: "spark", motion: "orbit", count: 24 },
      ],
    },
  },

  // ───────────── Fusions (jamais tirées) ─────────────
  {
    id: "orage_braises",
    name: "Braises d'orage",
    rarity: "epic",
    odds: 500,
    description: "Fusion d'Orage et de Cendre : des éclairs qui laissent des braises en tombant.",
    reveal: ["flash", "shockwave", "lightning"],
    special: {
      kind: "fusion",
      ingredients: [
        { auraId: "orage", count: 1 },
        { auraId: "cendre", count: 25 },
      ],
    },
    visual: {
      primary: "#ffb35c",
      secondary: "#5c8bff",
      sigil: "stormember",
      layers: [
        { type: "halo", intensity: 0.8 },
        { type: "particles", kind: "ember", motion: "fall", count: 26, colors: ["#ffb35c", "#ff6b3d"] },
        { type: "lightning", rate: 0.5 },
      ],
    },
  },
  {
    id: "geyser",
    name: "Geyser",
    rarity: "legendary",
    odds: 4_000,
    description: "Fusion de Phénix et d'Abysse : l'eau des profondeurs jaillit, brûlante.",
    reveal: ["flash", "shockwave", "shake", "distortion"],
    special: {
      kind: "fusion",
      ingredients: [
        { auraId: "phenix", count: 1 },
        { auraId: "abysse", count: 1 },
      ],
    },
    visual: {
      primary: "#7ae8ff",
      secondary: "#ff6b3d",
      sigil: "geyser",
      layers: [
        { type: "halo", intensity: 0.95, pulse: 0.8 },
        { type: "particles", kind: "drop", motion: "rise", count: 40, colors: ["#7ae8ff", "#ffffff"] },
        { type: "particles", kind: "ember", motion: "rise", count: 20, colors: ["#ff6b3d"] },
        { type: "particles", kind: "mist", motion: "rise", count: 12 },
      ],
    },
  },
  {
    id: "crepuscule",
    name: "Crépuscule",
    rarity: "mythical",
    odds: 30_000,
    description: "Fusion d'Éclipse et de Solstice : l'instant précis où le jour bascule dans la nuit.",
    reveal: ["flash", "shockwave", "distortion", "shake", "prismatic"],
    special: {
      kind: "fusion",
      ingredients: [
        { auraId: "eclipse", count: 1 },
        { auraId: "solstice", count: 1 },
      ],
    },
    visual: {
      primary: "#ff9d5c",
      secondary: "#5c3dff",
      sigil: "twilight",
      layers: [
        { type: "rays", count: 18, speed: 0.05 },
        { type: "halo", intensity: 1.1 },
        { type: "void", radius: 0.3 },
        { type: "particles", kind: "spark", motion: "orbit", count: 30, colors: ["#ff9d5c", "#b49cff"] },
      ],
    },
  },
  {
    id: "nova_sombre",
    name: "Nova sombre",
    rarity: "celestial",
    odds: 3_000_000,
    description: "Fusion de Supernova et de Nocturne : une étoile qui explose vers l'intérieur.",
    reveal: ["flash", "collapse", "shockwave", "warp", "shake"],
    special: {
      kind: "fusion",
      ingredients: [
        { auraId: "supernova", count: 1 },
        { auraId: "nocturne", count: 1 },
      ],
    },
    visual: {
      primary: "#ff3d7f",
      secondary: "#14003b",
      sigil: "darknova",
      layers: [
        { type: "starfield", count: 90 },
        { type: "void", radius: 0.45 },
        { type: "rays", count: 28, speed: -0.2 },
        { type: "rings", count: 3, speed: 0.9 },
        { type: "particles", kind: "spark", motion: "spiral-in", count: 80, colors: ["#ff3d7f", "#ffffff"] },
      ],
    },
  },
];

const BY_ID = new Map(AURAS.map((a) => [a.id, a]));

/** Auras qui entrent dans la table de tirage à l'instant `now` (fusions exclues, saisonnières si l'événement est actif). */
export function isRollable(aura: Aura, now?: number): boolean {
  const sp = aura.special;
  if (sp?.kind === "fusion") return false;
  if (sp?.kind === "seasonal") return now !== undefined && isEventActive(getEvent(sp.event), now);
  return true;
}

const rollableCache = new Map<string, readonly Aura[]>();

export function rollableAuras(now?: number): readonly Aura[] {
  const list = AURAS.filter((a) => isRollable(a, now));
  const key = list.map((a) => a.id).join(",");
  let cached = rollableCache.get(key);
  if (!cached) {
    cached = list;
    rollableCache.set(key, cached);
  }
  return cached;
}

export const FUSION_AURAS: readonly Aura[] = AURAS.filter((a) => a.special?.kind === "fusion");
export const SPECIAL_AURAS: readonly Aura[] = AURAS.filter((a) => a.special);

export function getAura(id: string): Aura | undefined {
  return BY_ID.get(id);
}

export function requireAura(id: string): Aura {
  const a = BY_ID.get(id);
  if (!a) throw new Error(`Aura inconnue : ${id}`);
  return a;
}
