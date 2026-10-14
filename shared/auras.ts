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
  | "prismatic";

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
    odds: 7,
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
    odds: 11,
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
    odds: 16,
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
];

const BY_ID = new Map(AURAS.map((a) => [a.id, a]));

export function getAura(id: string): Aura | undefined {
  return BY_ID.get(id);
}

export function requireAura(id: string): Aura {
  const a = BY_ID.get(id);
  if (!a) throw new Error(`Aura inconnue : ${id}`);
  return a;
}
