import { ACHIEVEMENTS, isAchievementMet } from "./achievements";
import { requireAura, getAura } from "./auras";
import {
  advanceRollClock,
  computeLuck,
  grantableRolls,
  isPotionActive,
  msUntilNextRoll,
  nextStreak,
} from "./luck";
import { POTIONS, POTION_MAX_STACK_MS, type PotionId } from "./potions";
import { computeDistribution, pickFromDistribution } from "./probability";
import { getRarity } from "./rarities";
import type { Rng } from "./random";
import { RECENT_LIMIT, discoveredCount, type PlayerState } from "./state";

export type GameErrorCode = "cooldown" | "invalid" | "not-owned" | "no-potion";

export class GameError extends Error {
  constructor(
    public code: GameErrorCode,
    message: string,
    public retryInMs?: number,
  ) {
    super(message);
    this.name = "GameError";
  }
}

export type PotionReward = Partial<Record<PotionId, number>>;

export interface RollResult {
  auraId: string;
  luck: number;
  blessed: boolean;
  isNew: boolean;
  rollNumber: number;
}

export interface ActionOutcome {
  state: PlayerState;
  /** Succès débloqués par cette action. */
  achievements: string[];
  /** Potions gagnées par cette action (paliers, découvertes, succès). */
  rewards: PotionReward;
}

export interface RollOutcome extends ActionOutcome {
  results: RollResult[];
}

/** Potions offertes tous les N rolls. */
export const ROLL_MILESTONE_REWARDS: { every: number; potion: PotionId }[] = [
  { every: 100, potion: "luck" },
  { every: 250, potion: "speed" },
  { every: 500, potion: "superLuck" },
  { every: 1_000, potion: "hourglass" },
];

/** Potion offerte à la première découverte d'une aura de ce palier ou plus. */
function discoveryReward(tier: number): PotionId | null {
  if (tier >= 5) return "hourglass";
  if (tier >= 4) return "superLuck";
  if (tier >= 3) return "luck";
  return null;
}

/** Temps d'inactivité au-delà duquel le temps de jeu cesse de compter. */
export const ACTIVE_GAP_MS = 90_000;

function addReward(into: PotionReward, add: PotionReward) {
  for (const [id, n] of Object.entries(add) as [PotionId, number][]) into[id] = (into[id] ?? 0) + n;
}

function grant(state: PlayerState, reward: PotionReward) {
  for (const [id, n] of Object.entries(reward) as [PotionId, number][]) state.potions.owned[id] += n;
}

function clone(state: PlayerState): PlayerState {
  return structuredClone(state);
}

/** Comptabilise le temps de jeu depuis la dernière activité. */
function touch(state: PlayerState, now: number) {
  const last = state.stats.lastActiveAt;
  if (last > 0 && now > last && now - last <= ACTIVE_GAP_MS) state.stats.playTimeMs += now - last;
  if (now > last) state.stats.lastActiveAt = now;
}

function pruneExpiredPotions(state: PlayerState, now: number) {
  for (const [id, until] of Object.entries(state.potions.active) as [PotionId, number][]) {
    if (until <= now) delete state.potions.active[id];
  }
}

/** Débloque les succès dont la condition est remplie et distribue leurs récompenses. */
function unlockAchievements(state: PlayerState, now: number, rewards: PotionReward): string[] {
  const unlocked: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (state.achievements[a.id] || !isAchievementMet(a, state)) continue;
    state.achievements[a.id] = now;
    unlocked.push(a.id);
    if (a.reward) {
      grant(state, a.reward);
      addReward(rewards, a.reward);
    }
  }
  return unlocked;
}

function isBetter(candidateId: string, currentId: string | null): boolean {
  if (!currentId) return true;
  const current = getAura(currentId);
  return !current || requireAura(candidateId).odds > current.odds;
}

/**
 * Lance jusqu'à `requested` rolls. Le nombre réellement accordé dépend du
 * temps de recharge (seau à jetons). Lève `GameError("cooldown")` si aucun.
 */
export function performRolls(input: PlayerState, now: number, requested: number, rng: Rng): RollOutcome {
  const granted = grantableRolls(input, now, requested);
  if (granted === 0) {
    throw new GameError("cooldown", "Recharge en cours", msUntilNextRoll(input, now));
  }

  const state = clone(input);
  state.stats.rollClock = advanceRollClock(input, now, granted);
  pruneExpiredPotions(state, now);
  touch(state, now);

  const rewards: PotionReward = {};
  const results: RollResult[] = [];

  for (let i = 0; i < granted; i++) {
    const rollNumber = state.stats.rolls + 1;
    const streak = nextStreak(state, now);
    const luck = computeLuck(state, now, rollNumber, streak);
    const aura = pickFromDistribution(computeDistribution(luck.total), rng());

    state.stats.rolls = rollNumber;
    state.stats.streak = streak;
    state.stats.maxStreak = Math.max(state.stats.maxStreak, streak);
    state.stats.lastRollAt = now;

    const entry = state.inventory[aura.id];
    const isNew = !entry;
    if (entry) {
      entry.count += 1;
      entry.lastAt = now;
    } else {
      state.inventory[aura.id] = { count: 1, firstAt: now, lastAt: now };
      const potion = discoveryReward(getRarity(aura.rarity).tier);
      if (potion) {
        grant(state, { [potion]: 1 });
        addReward(rewards, { [potion]: 1 });
      }
    }
    if (isBetter(aura.id, state.stats.bestAuraId)) state.stats.bestAuraId = aura.id;
    if (!state.equipped) state.equipped = aura.id;

    for (const m of ROLL_MILESTONE_REWARDS) {
      if (rollNumber % m.every === 0) {
        grant(state, { [m.potion]: 1 });
        addReward(rewards, { [m.potion]: 1 });
      }
    }

    state.recent.unshift({ auraId: aura.id, at: now, luck: luck.total });
    results.push({ auraId: aura.id, luck: luck.total, blessed: luck.blessed, isNew, rollNumber });
  }
  state.recent = state.recent.slice(0, RECENT_LIMIT);

  const achievements = unlockAchievements(state, now, rewards);
  return { state, results, achievements, rewards };
}

/** Boit une potion : la durée s'ajoute à celle restante, dans la limite du plafond. */
export function drinkPotion(input: PlayerState, potionId: PotionId, now: number): ActionOutcome {
  const potion = POTIONS[potionId];
  if (!potion) throw new GameError("invalid", "Potion inconnue");
  if (input.potions.owned[potionId] <= 0) throw new GameError("no-potion", "Tu n'as plus cette potion");

  const state = clone(input);
  pruneExpiredPotions(state, now);
  touch(state, now);
  state.potions.owned[potionId] -= 1;
  const start = isPotionActive(state, potionId, now) ? state.potions.active[potionId]! : now;
  state.potions.active[potionId] = Math.min(start + potion.durationMs, now + POTION_MAX_STACK_MS);
  state.stats.potionsUsed += 1;

  const rewards: PotionReward = {};
  const achievements = unlockAchievements(state, now, rewards);
  return { state, achievements, rewards };
}

export function equipAura(input: PlayerState, auraId: string | null): PlayerState {
  if (auraId !== null && !input.inventory[auraId]) throw new GameError("not-owned", "Aura non possédée");
  const state = clone(input);
  state.equipped = auraId;
  return state;
}

/** Signal d'activité périodique : compte le temps de jeu et vérifie les succès liés. */
export function heartbeat(input: PlayerState, now: number): ActionOutcome {
  const state = clone(input);
  pruneExpiredPotions(state, now);
  touch(state, now);
  const rewards: PotionReward = {};
  const achievements = unlockAchievements(state, now, rewards);
  return { state, achievements, rewards };
}

export interface LeaderboardEntry {
  name: string;
  rolls: number;
  /** « 1 sur N » de la meilleure aura (0 si aucune). */
  bestOdds: number;
  bestAuraId: string | null;
  collection: number;
  achievements: number;
  equipped: string | null;
  updatedAt: number;
}

export function toLeaderboardEntry(state: PlayerState, now: number): LeaderboardEntry {
  const best = state.stats.bestAuraId ? getAura(state.stats.bestAuraId) : undefined;
  return {
    name: state.name,
    rolls: state.stats.rolls,
    bestOdds: best?.odds ?? 0,
    bestAuraId: best?.id ?? null,
    collection: discoveredCount(state),
    achievements: Object.keys(state.achievements).length,
    equipped: state.equipped,
    updatedAt: now,
  };
}
