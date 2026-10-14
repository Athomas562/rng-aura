import { POTIONS, POTION_IDS, type PotionId } from "./potions";
import type { PlayerState } from "./state";

/** Temps de recharge de base entre deux rolls (ms). */
export const BASE_ROLL_COOLDOWN_MS = 900;
/** Marge tolérée côté serveur pour la latence réseau. */
export const COOLDOWN_TOLERANCE_MS = 120;
/** Nombre maximal de rolls accordés en une requête (auto-roll). */
export const MAX_ROLL_BATCH = 8;

/** Un roll sur N est « béni » et double la chance. */
export const BLESSED_EVERY = 10;
export const BLESSED_MULTIPLIER = 2;

/** Deux rolls séparés de moins de cette durée prolongent la série. */
export const STREAK_WINDOW_MS = 20_000;
/** +2 % de chance tous les 10 rolls de série, plafonné à +30 %. */
export const STREAK_STEP = 10;
export const STREAK_BONUS_PER_STEP = 0.02;
export const STREAK_BONUS_CAP = 0.3;

export interface LuckPart {
  label: string;
  kind: "add" | "mul";
  value: number;
}

export interface LuckBreakdown {
  total: number;
  parts: LuckPart[];
  blessed: boolean;
}

export function isPotionActive(state: PlayerState, id: PotionId, now: number): boolean {
  return (state.potions.active[id] ?? 0) > now;
}

export function streakBonus(streak: number): number {
  return Math.min(STREAK_BONUS_CAP, Math.floor(streak / STREAK_STEP) * STREAK_BONUS_PER_STEP);
}

/** Série qu'aurait le prochain roll s'il était lancé à `now`. */
export function nextStreak(state: PlayerState, now: number): number {
  const { lastRollAt, streak } = state.stats;
  return lastRollAt > 0 && now - lastRollAt <= STREAK_WINDOW_MS ? streak + 1 : 1;
}

/**
 * Chance appliquée à un roll.
 * total = (1 + Σ bonus additifs) × Π multiplicateurs
 *
 * @param rollNumber numéro (1-based) du roll concerné, pour le roll béni.
 * @param streak série au moment du roll.
 */
export function computeLuck(state: PlayerState, now: number, rollNumber: number, streak: number): LuckBreakdown {
  const parts: LuckPart[] = [];
  let additive = 1;
  let multiplier = 1;

  for (const id of POTION_IDS) {
    if (!isPotionActive(state, id, now)) continue;
    const { effect, name } = POTIONS[id];
    if (effect.kind === "luckAdd") {
      additive += effect.value;
      parts.push({ label: name, kind: "add", value: effect.value });
    } else if (effect.kind === "luckMul") {
      multiplier *= effect.value;
      parts.push({ label: name, kind: "mul", value: effect.value });
    }
  }

  const sb = streakBonus(streak);
  if (sb > 0) {
    additive += sb;
    parts.push({ label: `Série ×${streak}`, kind: "add", value: sb });
  }

  const blessed = rollNumber > 0 && rollNumber % BLESSED_EVERY === 0;
  if (blessed) {
    multiplier *= BLESSED_MULTIPLIER;
    parts.push({ label: "Roll béni", kind: "mul", value: BLESSED_MULTIPLIER });
  }

  return { total: additive * multiplier, parts, blessed };
}

/** Chance du prochain roll si on le lançait maintenant. */
export function previewNextLuck(state: PlayerState, now: number): LuckBreakdown {
  return computeLuck(state, now, state.stats.rolls + 1, nextStreak(state, now));
}

export function getRollCooldownMs(state: PlayerState, now: number): number {
  let cd = BASE_ROLL_COOLDOWN_MS;
  for (const id of POTION_IDS) {
    const { effect } = POTIONS[id];
    if (effect.kind === "cooldownMul" && isPotionActive(state, id, now)) cd *= effect.value;
  }
  return Math.round(cd);
}

/**
 * Seau à jetons : `rollClock` avance d'un temps de recharge par roll accordé.
 * Le crédit accumulé est plafonné à MAX_ROLL_BATCH rolls, ce qui permet à
 * l'auto-roll de grouper ses requêtes sans jamais dépasser le rythme autorisé.
 * La tolérance absorbe la latence réseau sans s'additionner d'une requête à l'autre.
 */
function effectiveClock(state: PlayerState, now: number, cd: number): number {
  return Math.max(state.stats.rollClock, now - MAX_ROLL_BATCH * cd);
}

export function grantableRolls(state: PlayerState, now: number, requested: number): number {
  if (!Number.isFinite(requested)) return 0;
  const want = Math.max(0, Math.min(MAX_ROLL_BATCH, Math.floor(requested)));
  if (want === 0) return 0;
  const cd = getRollCooldownMs(state, now);
  const available = Math.floor((now + COOLDOWN_TOLERANCE_MS - effectiveClock(state, now, cd)) / cd);
  return Math.max(0, Math.min(want, available));
}

/** Nouvelle valeur de `rollClock` après avoir accordé `granted` rolls. */
export function advanceRollClock(state: PlayerState, now: number, granted: number): number {
  const cd = getRollCooldownMs(state, now);
  return effectiveClock(state, now, cd) + granted * cd;
}

/** Délai avant de pouvoir lancer le prochain roll (0 = immédiatement). */
export function msUntilNextRoll(state: PlayerState, now: number): number {
  const cd = getRollCooldownMs(state, now);
  return Math.max(0, effectiveClock(state, now, cd) + cd - now);
}
