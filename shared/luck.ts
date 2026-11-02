import { upgradeBlessedReduction, upgradeCooldownMul, upgradeLuckBonus, upgradeStreakCapBonus } from "./economy";
import { activeEvents } from "./events";
import { PRESTIGE_LUCK } from "./progression";
import { POTIONS, POTION_IDS, type PotionId } from "./potions";
import type { RarityId } from "./rarities";
import type { PlayerState } from "./state";
import {
  talentBlessedReduction,
  talentCooldownMul,
  talentLuckBonus,
  talentStreakCapBonus,
  talentStreakWindowMs,
} from "./talents";

/** Temps de recharge de base entre deux rolls (ms). */
export const BASE_ROLL_COOLDOWN_MS = 900;
/** Marge tolérée côté serveur pour la latence réseau. */
export const COOLDOWN_TOLERANCE_MS = 120;
/** Nombre maximal de rolls demandés en une requête (auto-roll). */
export const MAX_ROLL_BATCH = 8;
/**
 * Crédit maximal accumulé pendant une pause, en rolls. Fixé à 1 : attendre ne permet
 * jamais d'enchaîner plusieurs rolls d'affilée en spammant (un roll par recharge, point).
 */
export const ROLL_BURST = 1;

/** Un roll sur N est « béni » et double la chance. */
export const BLESSED_EVERY = 10;
/** Période minimale du roll béni, talents et améliorations compris. */
export const BLESSED_EVERY_MIN = 5;
export const BLESSED_MULTIPLIER = 2;

/** Deux rolls séparés de moins de cette durée prolongent la série. */
export const STREAK_WINDOW_MS = 20_000;
/** +2 % de chance tous les 10 rolls de série, plafonné à +30 % (plus avec le talent Endurance). */
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
  /** Bénédiction garantie consommée par ce roll (béni grâce à la potion). */
  usedBlessing: boolean;
  /** Potion de chance ciblée active : multiplicateur supplémentaire pour une rareté. */
  focus: { rarity: RarityId; mul: number } | null;
}

export function isPotionActive(state: PlayerState, id: PotionId, now: number): boolean {
  return (state.potions.active[id] ?? 0) > now;
}

export function streakCap(state: PlayerState): number {
  return STREAK_BONUS_CAP + talentStreakCapBonus(state.talents) + upgradeStreakCapBonus(state.upgrades);
}

export function streakBonus(streak: number, cap = STREAK_BONUS_CAP): number {
  return Math.min(cap, Math.floor(streak / STREAK_STEP) * STREAK_BONUS_PER_STEP);
}

export function streakWindowMs(state: PlayerState): number {
  return STREAK_WINDOW_MS + talentStreakWindowMs(state.talents);
}

/** Série qu'aurait le prochain roll s'il était lancé à `now`. */
export function nextStreak(state: PlayerState, now: number): number {
  const { lastRollAt, streak } = state.stats;
  if (lastRollAt <= 0) return 1;
  const kept = now - lastRollAt <= streakWindowMs(state) || isPotionActive(state, "streakGuard", now);
  return kept ? streak + 1 : 1;
}

/** Période du roll béni (10, moins avec le talent Bénédiction et l'Auréole, jamais sous 5). */
export function blessedEvery(state: PlayerState): number {
  return Math.max(BLESSED_EVERY_MIN, BLESSED_EVERY - talentBlessedReduction(state.talents) - upgradeBlessedReduction(state.upgrades));
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
  const add = (label: string, value: number) => {
    if (value <= 0) return;
    additive += value;
    parts.push({ label, kind: "add", value });
  };
  const mul = (label: string, value: number) => {
    multiplier *= value;
    parts.push({ label, kind: "mul", value });
  };

  for (const id of POTION_IDS) {
    if (!isPotionActive(state, id, now)) continue;
    const { effect, name } = POTIONS[id];
    if (effect.kind === "luckAdd") add(name, effect.value);
    else if (effect.kind === "luckMul") mul(name, effect.value);
  }

  add(`Série ×${streak}`, streakBonus(streak, streakCap(state)));
  add(`Prestige ${state.prestige.level}`, state.prestige.level * PRESTIGE_LUCK);
  add("Talent Fortune", talentLuckBonus(state.talents));
  add("Trèfle doré", upgradeLuckBonus(state.upgrades));
  for (const e of activeEvents(now)) add(`Événement : ${e.name}`, e.luckBonus);

  const curse = state.curse;
  if (curse && now < curse.boonUntil) add("Marque maudite (bonus)", curse.luck);
  else if (curse && now < curse.baneUntil) mul("Marque maudite (malus)", curse.mul);

  const natural = rollNumber > 0 && rollNumber % blessedEvery(state) === 0;
  const usedBlessing = !natural && state.potions.pendingBlessings > 0;
  const blessed = natural || usedBlessing;
  if (blessed) mul(usedBlessing ? "Bénédiction garantie" : "Roll béni", BLESSED_MULTIPLIER);

  const focusTarget = state.potions.focusTarget;
  const focusEffect = POTIONS.focus.effect;
  const focus =
    focusTarget && isPotionActive(state, "focus", now) && focusEffect.kind === "focus"
      ? { rarity: focusTarget, mul: focusEffect.value }
      : null;

  return { total: additive * multiplier, parts, blessed, usedBlessing, focus };
}

/** Chance du prochain roll si on le lançait maintenant. */
export function previewNextLuck(state: PlayerState, now: number): LuckBreakdown {
  return computeLuck(state, now, state.stats.rolls + 1, nextStreak(state, now));
}

export function getRollCooldownMs(state: PlayerState, now: number): number {
  let cd = BASE_ROLL_COOLDOWN_MS * talentCooldownMul(state.talents) * upgradeCooldownMul(state.upgrades);
  for (const id of POTION_IDS) {
    const { effect } = POTIONS[id];
    if (effect.kind === "cooldownMul" && isPotionActive(state, id, now)) cd *= effect.value;
  }
  return Math.round(cd);
}

/**
 * Seau à jetons : `rollClock` avance d'un temps de recharge par roll accordé.
 * Le crédit accumulé est plafonné à ROLL_BURST roll : une pause ne se « rattrape » pas.
 * La tolérance absorbe la latence réseau sans s'additionner d'une requête à l'autre.
 */
function effectiveClock(state: PlayerState, now: number, cd: number): number {
  return Math.max(state.stats.rollClock, now - ROLL_BURST * cd);
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
