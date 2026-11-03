/**
 * Indices des succès secrets : règles publiques (niveaux et prix).
 * Les TEXTES des indices ne sont pas ici : ils vivent côté serveur (functions/src/hints.ts)
 * et ne sont envoyés au navigateur qu'une fois révélés.
 */
import { ACHIEVEMENTS } from "./achievements";

/** Prix de chaque niveau d'indice : 1 vague (gratuit), 2 précis, 3 quasi-solution. */
export const HINT_COSTS = [0, 50, 200] as const;
export const HINT_LEVELS = HINT_COSTS.length;
export const HINT_LABELS = ["Indice vague", "Indice précis", "Quasi-solution"] as const;

export const SECRET_ACHIEVEMENT_IDS: readonly string[] = ACHIEVEMENTS.filter((a) => a.secret).map((a) => a.id);

export function isSecretAchievement(id: unknown): id is string {
  return typeof id === "string" && SECRET_ACHIEVEMENT_IDS.includes(id);
}

/** Prix du prochain indice (null si les 3 sont déjà révélés). */
export function nextHintCost(level: number): number | null {
  return level < HINT_LEVELS ? HINT_COSTS[level] : null;
}
