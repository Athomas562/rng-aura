import type { RarityId } from "./rarities";

export type PotionId = "luck" | "superLuck" | "speed" | "hourglass" | "focus" | "streakGuard" | "blessing" | "purify";

export type PotionEffect =
  /** Ajoute `value` à la chance de base (1 + Σ bonus). */
  | { kind: "luckAdd"; value: number }
  /** Multiplie la chance totale. */
  | { kind: "luckMul"; value: number }
  /** Multiplie le temps de recharge entre deux rolls. */
  | { kind: "cooldownMul"; value: number }
  /** Multiplie la chance d'une seule rareté, choisie en buvant la potion. */
  | { kind: "focus"; value: number }
  /** La série ne peut pas être interrompue tant que la potion est active. */
  | { kind: "streakGuard" }
  /** Objet instantané : le prochain roll est béni. */
  | { kind: "blessNext" }
  /** Objet instantané : lève la malédiction en cours. */
  | { kind: "cleanse" };

export interface Potion {
  id: PotionId;
  name: string;
  description: string;
  /** 0 pour un objet à effet instantané. */
  durationMs: number;
  effect: PotionEffect;
  color: string;
}

/** Durée maximale cumulable pour une même potion. */
export const POTION_MAX_STACK_MS = 30 * 60_000;
/** Bénédictions garanties en attente au maximum. */
export const MAX_PENDING_BLESSINGS = 5;

/** Raretés que la potion de chance ciblée peut viser. */
export const FOCUS_TARGETS: readonly RarityId[] = [
  "rare",
  "epic",
  "legendary",
  "mythical",
  "corrupted",
  "divine",
  "celestial",
  "primordial",
  "transcendent",
  "dream",
  "infinity",
  "void",
  "beyond",
];

export const POTIONS: Record<PotionId, Potion> = {
  luck: {
    id: "luck",
    name: "Potion de chance",
    description: "+100 % de chance pendant 5 minutes.",
    durationMs: 5 * 60_000,
    effect: { kind: "luckAdd", value: 1 },
    color: "#5ee6a0",
  },
  superLuck: {
    id: "superLuck",
    name: "Potion de super chance",
    description: "+400 % de chance pendant 2 minutes.",
    durationMs: 2 * 60_000,
    effect: { kind: "luckAdd", value: 4 },
    color: "#ffc94d",
  },
  speed: {
    id: "speed",
    name: "Élixir de célérité",
    description: "Temps de recharge des rolls divisé par 2 pendant 5 minutes.",
    durationMs: 5 * 60_000,
    effect: { kind: "cooldownMul", value: 0.5 },
    color: "#4cc3ff",
  },
  hourglass: {
    id: "hourglass",
    name: "Sablier du destin",
    description: "Multiplie toute ta chance par 2 pendant 3 minutes.",
    durationMs: 3 * 60_000,
    effect: { kind: "luckMul", value: 2 },
    color: "#b072ff",
  },
  focus: {
    id: "focus",
    name: "Potion de chance ciblée",
    description: "Chance ×3 pour la rareté de ton choix pendant 3 minutes.",
    durationMs: 3 * 60_000,
    effect: { kind: "focus", value: 3 },
    color: "#ff7ad9",
  },
  streakGuard: {
    id: "streakGuard",
    name: "Potion de série",
    description: "Ta série ne peut pas retomber pendant 10 minutes, même si tu fais une pause.",
    durationMs: 10 * 60_000,
    effect: { kind: "streakGuard" },
    color: "#ff9d3d",
  },
  blessing: {
    id: "blessing",
    name: "Bénédiction garantie",
    description: "Ton prochain roll est béni (chance ×2), quoi qu'il arrive.",
    durationMs: 0,
    effect: { kind: "blessNext" },
    color: "#fff2a8",
  },
  purify: {
    id: "purify",
    name: "Eau bénite",
    description: "Lève immédiatement une malédiction (bonus et malus compris).",
    durationMs: 0,
    effect: { kind: "cleanse" },
    color: "#bfe9ff",
  },
};

export const POTION_IDS = Object.keys(POTIONS) as PotionId[];
/** Potions à durée (affichées avec un minuteur). */
export const TIMED_POTION_IDS = POTION_IDS.filter((id) => POTIONS[id].durationMs > 0);

export function isPotionId(v: unknown): v is PotionId {
  return typeof v === "string" && (POTION_IDS as string[]).includes(v);
}
