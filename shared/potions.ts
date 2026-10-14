export type PotionId = "luck" | "superLuck" | "speed" | "hourglass";

export type PotionEffect =
  /** Ajoute `value` à la chance de base (1 + Σ bonus). */
  | { kind: "luckAdd"; value: number }
  /** Multiplie la chance totale. */
  | { kind: "luckMul"; value: number }
  /** Multiplie le temps de recharge entre deux rolls. */
  | { kind: "cooldownMul"; value: number };

export interface Potion {
  id: PotionId;
  name: string;
  description: string;
  durationMs: number;
  effect: PotionEffect;
  color: string;
}

/** Durée maximale cumulable pour une même potion. */
export const POTION_MAX_STACK_MS = 30 * 60_000;

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
};

export const POTION_IDS = Object.keys(POTIONS) as PotionId[];

export function isPotionId(v: unknown): v is PotionId {
  return typeof v === "string" && (POTION_IDS as string[]).includes(v);
}
