import { ACHIEVEMENTS, isAchievementMet } from "./achievements";
import { HINT_LABELS, isSecretAchievement, nextHintCost } from "./hints";
import {
  ACHIEVEMENT_SHARDS,
  DISCOVERY_SHARDS,
  LEDGER_LIMIT,
  MAX_POTIONS_PER_PURCHASE,
  MISSION_SHARDS,
  POTION_PRICES,
  POTION_STOCK_LIMIT,
  PRESTIGE_SHARDS,
  QUEST_SHARDS,
  SECRET_ACHIEVEMENT_SHARDS,
  SHARD_CAP,
  getCosmetic,
  emptyUpgrades,
  getUpgrade,
  potionPrice,
  rollShards,
  upgradePotionDurationMul,
  type CosmeticId,
  type CosmeticKind,
  type UpgradeId,
} from "./economy";
import { getAura, requireAura, type Aura } from "./auras";
import {
  advanceRollClock,
  computeLuck,
  grantableRolls,
  isPotionActive,
  msUntilNextRoll,
  nextStreak,
  type LuckBreakdown,
} from "./luck";
import { FOCUS_TARGETS, MAX_PENDING_BLESSINGS, POTIONS, type PotionId } from "./potions";
import { computeDistribution, pickFromDistribution, type DistributionEntry } from "./probability";
import {
  DISCOVERY_XP_MUL,
  PRESTIGE_MAX,
  PRESTIGE_REWARD,
  PRESTIGE_ROLLS,
  canPrestige,
  getTitle,
  levelOf,
  runRolls,
  slotCount,
  talentPointsFor,
  xpForRarity,
} from "./progression";
import {
  MISSIONS,
  TIER_COUNTERS,
  emptyPeriod,
  getMission,
  periodKey,
  questProgress,
  questsFor,
  type QuestCounter,
  type QuestScope,
} from "./quests";
import { getRarity, isRarityId, tierOf, type RarityId } from "./rarities";
import type { Rng } from "./random";
import { PRESTIGE_HISTORY_LIMIT, RECENT_LIMIT, discoveredCount, type PlayerState } from "./state";
import { emptyTalents, getTalent, spentTalentPoints, talentPotionDurationMul, talentXpMul, type TalentId } from "./talents";

export type GameErrorCode = "cooldown" | "invalid" | "not-owned" | "no-potion" | "funds";

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
  /** Première découverte (codex) : jamais redonnée après un prestige. */
  isNew: boolean;
  rollNumber: number;
  xp: number;
  /** Éclats gagnés par ce roll (rareté, série, béni, découverte). */
  shards: number;
  /** Rareté ciblée par une potion de chance ciblée active pendant ce roll. */
  focus?: RarityId;
}

export interface ActionOutcome {
  state: PlayerState;
  /** Succès débloqués par cette action. */
  achievements: string[];
  /** Potions gagnées par cette action (paliers, découvertes, succès, quêtes). */
  rewards: PotionReward;
  /** Nouveau niveau atteint pendant l'action. */
  levelUp?: number;
  /** Éclats gagnés pendant l'action (après plafond). */
  shards: number;
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
  { every: 1_500, potion: "focus" },
  { every: 2_000, potion: "blessing" },
  { every: 750, potion: "xpBoost" },
];

/** Potion offerte à la première découverte d'une aura de ce rang ou plus. */
function discoveryReward(tier: number): PotionId | null {
  if (tier >= tierOf("mythical")) return "hourglass";
  if (tier >= tierOf("legendary")) return "superLuck";
  if (tier >= tierOf("epic")) return "luck";
  return null;
}

/** Temps d'inactivité au-delà duquel le temps de jeu cesse de compter. */
export const ACTIVE_GAP_MS = 90_000;

/** Gains d'Éclats d'une action, groupés par motif pour l'historique. Crédités en une fois à la fin. */
type Earnings = Map<string, number>;

function earn(eco: Earnings, reason: string, amount: number) {
  if (amount > 0) eco.set(reason, (eco.get(reason) ?? 0) + Math.floor(amount));
}

/** Crédite les gains (plafonnés) et les inscrit dans l'historique. Renvoie le total crédité. */
function settle(state: PlayerState, eco: Earnings, now: number): number {
  let total = 0;
  for (const [reason, amount] of eco) {
    const credited = Math.min(amount, SHARD_CAP - state.shards);
    if (credited <= 0) continue;
    state.shards += credited;
    state.stats.shardsEarned += credited;
    total += credited;
    state.ledger.unshift({ at: now, amount: credited, reason, balance: state.shards });
  }
  state.ledger = state.ledger.slice(0, LEDGER_LIMIT);
  return total;
}

/** Débite un achat après avoir vérifié le solde stocké. */
function spend(state: PlayerState, cost: number, reason: string, now: number) {
  if (!Number.isSafeInteger(cost) || cost <= 0) throw new GameError("invalid", "Prix invalide");
  if (state.shards < cost) throw new GameError("funds", `Il te manque ${(cost - state.shards).toLocaleString("fr-FR")} éclats`);
  state.shards -= cost;
  state.stats.shardsSpent += cost;
  state.ledger.unshift({ at: now, amount: -cost, reason, balance: state.shards });
  state.ledger = state.ledger.slice(0, LEDGER_LIMIT);
}

function addReward(into: PotionReward, add: PotionReward) {
  for (const [id, n] of Object.entries(add) as [PotionId, number][]) into[id] = (into[id] ?? 0) + n;
}

function grant(state: PlayerState, reward: PotionReward, rewards?: PotionReward) {
  for (const [id, n] of Object.entries(reward) as [PotionId, number][]) state.potions.owned[id] += n;
  if (rewards) addReward(rewards, reward);
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

function pruneExpired(state: PlayerState, now: number) {
  for (const [id, until] of Object.entries(state.potions.active) as [PotionId, number][]) {
    if (until <= now) delete state.potions.active[id];
  }
  if (!state.potions.active.focus) state.potions.focusTarget = null;
  if (state.curse && state.curse.baneUntil <= now) state.curse = null;
}

/** Remet à zéro la progression des quêtes quand la journée ou la semaine change. */
export function refreshQuests(state: PlayerState, now: number) {
  for (const scope of ["daily", "weekly"] as const) {
    const key = periodKey(scope, now);
    if (state.quests[scope].key !== key) state.quests[scope] = emptyPeriod(key);
  }
}

function bump(state: PlayerState, counter: QuestCounter, by = 1) {
  for (const scope of ["daily", "weekly"] as const) {
    const c = state.quests[scope].counters;
    c[counter] = (c[counter] ?? 0) + by;
  }
}

function bumpMax(state: PlayerState, counter: QuestCounter, value: number) {
  for (const scope of ["daily", "weekly"] as const) {
    const c = state.quests[scope].counters;
    c[counter] = Math.max(c[counter] ?? 0, value);
  }
}

/** Préparation commune à toutes les actions. */
function begin(input: PlayerState, now: number): PlayerState {
  const state = clone(input);
  pruneExpired(state, now);
  refreshQuests(state, now);
  touch(state, now);
  return state;
}

/** Débloque les succès dont la condition est remplie et distribue leurs récompenses. */
function unlockAchievements(state: PlayerState, now: number, rewards: PotionReward, eco: Earnings): string[] {
  const unlocked: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (state.achievements[a.id] || !isAchievementMet(a, state)) continue;
    state.achievements[a.id] = now;
    unlocked.push(a.id);
    if (a.reward) grant(state, a.reward, rewards);
    earn(eco, "Succès", a.secret ? SECRET_ACHIEVEMENT_SHARDS : ACHIEVEMENT_SHARDS);
  }
  return unlocked;
}

/** Termine une action : succès, crédit des Éclats, détection de montée de niveau. */
function finish(state: PlayerState, before: PlayerState, now: number, rewards: PotionReward, eco: Earnings = new Map()): ActionOutcome {
  const achievements = unlockAchievements(state, now, rewards, eco);
  const shards = settle(state, eco, now);
  const lvBefore = levelOf(before);
  const lvAfter = levelOf(state);
  return { state, achievements, rewards, shards, ...(lvAfter > lvBefore ? { levelUp: lvAfter } : {}) };
}

export function isBetter(candidateId: string, currentId: string | null): boolean {
  if (!currentId) return true;
  const current = getAura(currentId);
  return !current || requireAura(candidateId).odds > current.odds;
}

/** Ajoute un exemplaire d'une aura (roll ou fusion) : inventaire, codex, XP, récompense de découverte. */
function obtain(state: PlayerState, aura: Aura, now: number, rewards: PotionReward, eco: Earnings): { isNew: boolean; xp: number } {
  const entry = state.inventory[aura.id];
  if (entry) {
    entry.count += 1;
    entry.lastAt = now;
  } else {
    state.inventory[aura.id] = { count: 1, firstAt: now, lastAt: now, firstRoll: state.stats.rolls };
  }

  const codex = state.codex[aura.id];
  const isNew = !codex;
  if (codex) codex.total += 1;
  else {
    state.codex[aura.id] = { firstAt: now, total: 1 };
    const potion = discoveryReward(getRarity(aura.rarity).tier);
    if (potion) grant(state, { [potion]: 1 }, rewards);
    bump(state, "discover");
    earn(eco, "Premières découvertes", DISCOVERY_SHARDS * (getRarity(aura.rarity).tier + 1));
  }

  const xp = Math.round(xpForRarity(aura.rarity) * (isNew ? DISCOVERY_XP_MUL : 1) * xpMultiplier(state, now));
  state.xp += xp;
  bump(state, "xp", xp);

  if (isBetter(aura.id, state.stats.bestAuraId)) state.stats.bestAuraId = aura.id;
  if (!state.equipped) state.equipped = aura.id;
  return { isNew, xp };
}

/** Multiplicateur d'XP : talent Érudit × potion d'érudition (multiplicatif, ex. 1,10 × 2 = 2,2). */
export function xpMultiplier(state: PlayerState, now: number): number {
  const effect = POTIONS.xpBoost.effect;
  const potion = isPotionActive(state, "xpBoost", now) && effect.kind === "xpMul" ? effect.value : 1;
  return talentXpMul(state.talents) * potion;
}

/** Distribution utilisée par le serveur pour un roll (saisonnières selon `now`, potion ciblée). */
export function distributionFor(luck: Pick<LuckBreakdown, "total" | "focus">, now: number): DistributionEntry[] {
  return computeDistribution(luck.total, { now, focus: luck.focus });
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

  const state = begin(input, now);
  state.stats.rollClock = advanceRollClock(input, now, granted);

  const rewards: PotionReward = {};
  const results: RollResult[] = [];
  const eco: Earnings = new Map();

  for (let i = 0; i < granted; i++) {
    const rollNumber = state.stats.rolls + 1;
    const streak = nextStreak(state, now);
    const luck = computeLuck(state, now, rollNumber, streak);
    if (luck.usedBlessing) state.potions.pendingBlessings -= 1;
    const aura = pickFromDistribution(distributionFor(luck, now), rng());

    state.stats.rolls = rollNumber;
    state.stats.streak = streak;
    state.stats.maxStreak = Math.max(state.stats.maxStreak, streak);
    state.stats.lastRollAt = now;
    if (luck.blessed) {
      state.stats.blessedRolls += 1;
      bump(state, "blessed");
    }

    const { isNew, xp } = obtain(state, aura, now, rewards, eco);
    // Éclats du roll (la part « découverte » est comptée par obtain).
    const shards = rollShards(aura.rarity, streak, luck.blessed, isNew);
    earn(eco, "Rolls", rollShards(aura.rarity, streak, luck.blessed, false));

    bump(state, "rolls");
    bumpMax(state, "streak", streak);
    const tier = getRarity(aura.rarity).tier;
    for (const t of TIER_COUNTERS) if (tier >= tierOf(t.rarity)) bump(state, t.key);

    // Marque maudite : bonus immédiat, puis malus.
    const sp = aura.special;
    if (sp?.kind === "cursed") {
      state.curse = { boonUntil: now + sp.boonMs, baneUntil: now + sp.boonMs + sp.baneMs, luck: sp.boonLuck, mul: sp.baneMul };
    }

    for (const m of ROLL_MILESTONE_REWARDS) {
      if (rollNumber % m.every === 0) grant(state, { [m.potion]: 1 }, rewards);
    }

    state.recent.unshift({ auraId: aura.id, at: now, luck: luck.total });
    results.push({
      auraId: aura.id,
      luck: luck.total,
      blessed: luck.blessed,
      isNew,
      rollNumber,
      xp,
      shards,
      ...(luck.focus ? { focus: luck.focus.rarity } : {}),
    });
  }
  state.recent = state.recent.slice(0, RECENT_LIMIT);

  return { ...finish(state, input, now, rewards, eco), results };
}

/**
 * Boit une potion. Les potions à durée s'ajoutent au temps restant (plafonné) ;
 * les objets instantanés agissent tout de suite. La potion ciblée exige une rareté.
 */
export function drinkPotion(input: PlayerState, potionId: PotionId, now: number, target?: unknown): ActionOutcome {
  const potion = POTIONS[potionId];
  if (!potion) throw new GameError("invalid", "Potion inconnue");
  if (input.potions.owned[potionId] <= 0) throw new GameError("no-potion", "Tu n'as plus cette potion");

  const state = begin(input, now);
  const effect = potion.effect;

  if (effect.kind === "blessNext") {
    if (state.potions.pendingBlessings >= MAX_PENDING_BLESSINGS) {
      throw new GameError("invalid", `Pas plus de ${MAX_PENDING_BLESSINGS} bénédictions en attente`);
    }
    state.potions.pendingBlessings += 1;
  } else if (effect.kind === "cleanse") {
    if (!state.curse) throw new GameError("invalid", "Aucune malédiction à lever");
    state.curse = null;
  } else {
    let start = isPotionActive(state, potionId, now) ? state.potions.active[potionId]! : now;
    if (effect.kind === "focus") {
      if (!isRarityId(target) || !FOCUS_TARGETS.includes(target)) throw new GameError("invalid", "Choisis une rareté à cibler");
      // Changer de cible repart de zéro ; la même cible prolonge la durée.
      if (state.potions.focusTarget !== target) start = now;
      state.potions.focusTarget = target;
    }
    const duration = Math.round(potion.durationMs * talentPotionDurationMul(state.talents) * upgradePotionDurationMul(state.upgrades));
    state.potions.active[potionId] = start + duration;
    if (effect.kind === "streakGuard") state.stats.streakGuardEnd = state.potions.active[potionId]!;
  }

  state.potions.owned[potionId] -= 1;
  state.stats.potionsUsed += 1;
  bump(state, "potions");
  return finish(state, input, now, {});
}

/**
 * Équipe une aura dans un emplacement : 0 = aura principale, 1+ = emplacements
 * supplémentaires débloqués par le niveau. `null` vide l'emplacement.
 */
export function equipAura(input: PlayerState, auraId: string | null, slot = 0): PlayerState {
  if (!Number.isInteger(slot) || slot < 0 || slot >= slotCount(input)) {
    throw new GameError("invalid", "Emplacement non débloqué");
  }
  if (auraId !== null && !input.inventory[auraId]) throw new GameError("not-owned", "Aura non possédée");
  const state = clone(input);
  const extra = slotCount(state) - 1;
  const slots = Array.from({ length: extra }, (_, i) => state.slots[i] ?? null);

  if (slot === 0) {
    state.equipped = auraId;
    // Une aura n'occupe qu'un emplacement.
    for (let i = 0; i < slots.length; i++) if (slots[i] === auraId) slots[i] = null;
  } else {
    if (auraId !== null && state.equipped === auraId) throw new GameError("invalid", "Cette aura est déjà ton aura principale");
    for (let i = 0; i < slots.length; i++) if (slots[i] === auraId) slots[i] = null;
    slots[slot - 1] = auraId;
  }
  state.slots = slots;
  return state;
}

/** Signal d'activité périodique : compte le temps de jeu et vérifie les succès liés. */
export function heartbeat(input: PlayerState, now: number): ActionOutcome {
  return finish(begin(input, now), input, now, {});
}

// ───────────── Fusion ─────────────

export interface FusionOutcome extends ActionOutcome {
  auraId: string;
  isNew: boolean;
  xp: number;
}

/** Vérifie qu'une fusion est possible (il faut garder au moins un exemplaire de chaque ingrédient). */
export function fusionMissing(state: PlayerState, aura: Aura): { auraId: string; need: number; have: number }[] {
  const sp = aura.special;
  if (sp?.kind !== "fusion") return [];
  return sp.ingredients
    .map((i) => ({ auraId: i.auraId, need: i.count + 1, have: state.inventory[i.auraId]?.count ?? 0 }))
    .filter((x) => x.have < x.need);
}

export function fuseAura(input: PlayerState, auraId: string, now: number): FusionOutcome {
  const aura = getAura(auraId);
  const sp = aura?.special;
  if (!aura || sp?.kind !== "fusion") throw new GameError("invalid", "Cette aura ne s'obtient pas par fusion");
  if (fusionMissing(input, aura).length > 0) {
    throw new GameError("not-owned", "Ingrédients insuffisants (garde au moins un exemplaire de chaque)");
  }

  const state = begin(input, now);
  for (const ing of sp.ingredients) {
    const entry = state.inventory[ing.auraId];
    entry.count -= ing.count;
  }
  const rewards: PotionReward = {};
  const eco: Earnings = new Map();
  const { isNew, xp } = obtain(state, aura, now, rewards, eco);
  earn(eco, "Fusions", rollShards(aura.rarity, 0, false, false));
  state.stats.fusions += 1;
  bump(state, "fusions");
  return { ...finish(state, input, now, rewards, eco), auraId, isNew, xp };
}

// ───────────── Prestige ─────────────

export function doPrestige(input: PlayerState, now: number): ActionOutcome {
  if (input.prestige.level >= PRESTIGE_MAX) throw new GameError("invalid", "Prestige maximal atteint");
  if (!canPrestige(input)) {
    throw new GameError("invalid", `Il faut ${PRESTIGE_ROLLS.toLocaleString("fr-FR")} rolls depuis ta dernière renaissance`);
  }
  const state = begin(input, now);

  let best: string | null = null;
  for (const id of Object.keys(state.inventory)) if (isBetter(id, best)) best = id;
  const level = state.prestige.level + 1;
  state.prestige = {
    level,
    runStartRolls: state.stats.rolls,
    history: [
      ...state.prestige.history,
      { at: now, level, runRolls: runRolls(state), bestAuraId: best, collection: Object.keys(state.inventory).length },
    ].slice(-PRESTIGE_HISTORY_LIMIT),
  };
  // Les auras sont conservées. Repartent de zéro : Éclats et améliorations de la boutique.
  // Codex, niveau, talents, cosmétiques, succès, potions et record de rareté sont conservés.
  if (state.shards > 0) {
    state.ledger.unshift({ at: now, amount: -state.shards, reason: `Renaissance ${level} : remise à zéro`, balance: 0 });
  }
  state.shards = 0;
  state.upgrades = emptyUpgrades();
  // La série n'est pas touchée : elle ne dépend que du rythme des rolls.
  // L'Écrin est remis à zéro : on retire les emplacements qui n'existent plus.
  state.slots = state.slots.slice(0, Math.max(0, slotCount(state) - 1));

  const rewards: PotionReward = {};
  grant(state, PRESTIGE_REWARD, rewards);
  const eco: Earnings = new Map([[`Prestige ${level}`, PRESTIGE_SHARDS * level]]);
  return finish(state, input, now, rewards, eco);
}

// ───────────── Talents, titre, Mimique ─────────────

export function learnTalent(input: PlayerState, talentId: TalentId): PlayerState {
  const talent = getTalent(talentId);
  const rank = input.talents[talentId] ?? 0;
  if (rank >= talent.maxRank) throw new GameError("invalid", "Talent déjà au rang maximal");
  if (talentPointsFor(input) - spentTalentPoints(input.talents) <= 0) throw new GameError("invalid", "Aucun point de talent disponible");
  if (talent.requires && (input.talents[talent.requires.talent] ?? 0) < talent.requires.rank) {
    throw new GameError("invalid", `Nécessite ${getTalent(talent.requires.talent).name} rang ${talent.requires.rank}`);
  }
  const state = clone(input);
  state.talents[talentId] = rank + 1;
  return state;
}

/** Redistribution gratuite de tous les points de talent. */
export function resetTalents(input: PlayerState): PlayerState {
  const state = clone(input);
  state.talents = emptyTalents();
  return state;
}

export function setTitle(input: PlayerState, titleId: string | null): PlayerState {
  if (titleId !== null) {
    const title = getTitle(titleId);
    if (!title) throw new GameError("invalid", "Titre inconnu");
    if (!title.unlocked(input)) throw new GameError("invalid", "Titre verrouillé");
  }
  const state = clone(input);
  state.title = titleId;
  return state;
}

export function setMimic(input: PlayerState, auraId: string | null): PlayerState {
  if (!Object.keys(input.inventory).some((id) => getAura(id)?.special?.kind === "mimic")) {
    throw new GameError("not-owned", "Tu ne possèdes pas Mimique");
  }
  if (auraId !== null) {
    if (!input.inventory[auraId]) throw new GameError("not-owned", "Aura non possédée");
    if (getAura(auraId)?.special?.kind === "mimic") throw new GameError("invalid", "Mimique ne peut pas se copier elle-même");
  }
  const state = clone(input);
  state.mimicOf = auraId;
  return state;
}

// ───────────── Quêtes et missions ─────────────

export function claimQuest(input: PlayerState, scope: QuestScope, questId: string, now: number): ActionOutcome {
  const state = begin(input, now);
  const period = state.quests[scope];
  const quest = questsFor(scope, period.key).find((q) => q.id === questId);
  if (!quest) throw new GameError("invalid", "Cette quête n'est pas disponible");
  if (period.claimed[questId]) throw new GameError("invalid", "Récompense déjà réclamée");
  if (questProgress(quest, period) < quest.target) throw new GameError("invalid", "Quête pas encore terminée");

  period.claimed[questId] = now;
  state.stats.questsClaimed += 1;
  const rewards: PotionReward = {};
  grant(state, quest.reward, rewards);
  const eco: Earnings = new Map([[`Quête : ${quest.name}`, QUEST_SHARDS[scope]]]);
  return finish(state, input, now, rewards, eco);
}

export function claimMission(input: PlayerState, missionId: string, now: number): ActionOutcome {
  const mission = getMission(missionId);
  if (!mission) throw new GameError("invalid", "Mission inconnue");
  const state = begin(input, now);
  const stage = state.quests.missions[missionId] ?? 0;
  const next = mission.stages[stage];
  if (!next) throw new GameError("invalid", "Mission déjà terminée");
  if (mission.value(state) < next.target) throw new GameError("invalid", "Étape pas encore atteinte");

  state.quests.missions[missionId] = stage + 1;
  const rewards: PotionReward = {};
  grant(state, next.reward, rewards);
  const eco: Earnings = new Map([[`Mission : ${mission.name}`, MISSION_SHARDS * (stage + 1)]]);
  return finish(state, input, now, rewards, eco);
}

/** Missions dont une étape peut être réclamée (pour un badge dans l'interface). */
export function claimableCount(state: PlayerState, now: number): number {
  let n = 0;
  for (const scope of ["daily", "weekly"] as const) {
    const key = periodKey(scope, now);
    const period = state.quests[scope].key === key ? state.quests[scope] : emptyPeriod(key);
    for (const q of questsFor(scope, key)) if (!period.claimed[q.id] && questProgress(q, period) >= q.target) n++;
  }
  for (const m of MISSIONS) {
    const next = m.stages[state.quests.missions[m.id] ?? 0];
    if (next && m.value(state) >= next.target) n++;
  }
  return n;
}

// ───────────── Boutique ─────────────

/** Achète le niveau suivant d'une amélioration permanente. */
export function buyUpgrade(input: PlayerState, upgradeId: UpgradeId, now: number): ActionOutcome {
  const upgrade = getUpgrade(upgradeId);
  const level = input.upgrades[upgradeId] ?? 0;
  if (level >= upgrade.maxLevel) throw new GameError("invalid", "Niveau maximal déjà atteint");
  const state = begin(input, now);
  spend(state, upgrade.cost(level), `Achat : ${upgrade.name} niv. ${level + 1}`, now);
  state.upgrades[upgradeId] = level + 1;
  return finish(state, input, now, {});
}

/** Achète des potions à l'unité (1 à 10 par achat, stock plafonné). */
export function buyPotion(input: PlayerState, potionId: PotionId, quantity: number, now: number): ActionOutcome {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_POTIONS_PER_PURCHASE) {
    throw new GameError("invalid", `Quantité entre 1 et ${MAX_POTIONS_PER_PURCHASE}`);
  }
  if (!POTION_PRICES[potionId]) throw new GameError("invalid", "Potion non vendue");
  const price = potionPrice(potionId, quantity);
  if (input.potions.owned[potionId] + quantity > POTION_STOCK_LIMIT) {
    throw new GameError("invalid", `Stock maximal : ${POTION_STOCK_LIMIT}`);
  }
  const state = begin(input, now);
  spend(state, price, `Achat : ${quantity}× ${POTIONS[potionId].name}`, now);
  state.potions.owned[potionId] += quantity;
  return finish(state, input, now, {});
}

/** Achète un cosmétique (une seule fois) et le porte immédiatement. */
export function buyCosmetic(input: PlayerState, cosmeticId: CosmeticId, now: number): ActionOutcome {
  const cosmetic = getCosmetic(cosmeticId);
  if (input.cosmetics.owned[cosmeticId]) throw new GameError("invalid", "Déjà acheté");
  const state = begin(input, now);
  spend(state, cosmetic.price, `Achat : ${cosmetic.name}`, now);
  state.cosmetics.owned[cosmeticId] = now;
  state.cosmetics[cosmetic.kind] = cosmeticId;
  return finish(state, input, now, {});
}

/** Porte ou retire un cosmétique possédé. */
export function wearCosmetic(input: PlayerState, kind: CosmeticKind, cosmeticId: CosmeticId | null): PlayerState {
  if (cosmeticId !== null) {
    if (!input.cosmetics.owned[cosmeticId]) throw new GameError("not-owned", "Cosmétique non acheté");
    if (getCosmetic(cosmeticId).kind !== kind) throw new GameError("invalid", "Type de cosmétique incorrect");
  }
  const state = clone(input);
  state.cosmetics[kind] = cosmeticId;
  return state;
}

// ───────────── Indices des succès secrets ─────────────

/** Révèle le niveau d'indice suivant d'un succès secret (1 gratuit, 2 à 50, 3 à 200 éclats). */
export function revealHint(input: PlayerState, achievementId: string, now: number): ActionOutcome {
  if (!isSecretAchievement(achievementId)) throw new GameError("invalid", "Ce succès n'a pas d'indice");
  if (input.achievements[achievementId]) throw new GameError("invalid", "Succès déjà débloqué : indice inutile");
  const level = input.hints[achievementId] ?? 0;
  const cost = nextHintCost(level);
  if (cost === null) throw new GameError("invalid", "Tous les indices sont déjà révélés");
  const state = begin(input, now);
  if (cost > 0) spend(state, cost, `Indice ${HINT_LABELS[level].toLowerCase()}`, now);
  state.hints[achievementId] = level + 1;
  return finish(state, input, now, {});
}

// ───────────── Classement ─────────────

export interface LeaderboardEntry {
  name: string;
  rolls: number;
  /** « 1 sur N » de la meilleure aura (0 si aucune). */
  bestOdds: number;
  bestAuraId: string | null;
  collection: number;
  achievements: number;
  equipped: string | null;
  level: number;
  prestige: number;
  /** Auras à mécanique spéciale découvertes. */
  special: number;
  title: string | null;
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
    level: levelOf(state),
    prestige: state.prestige.level,
    special: Object.keys(state.codex).filter((id) => getAura(id)?.special).length,
    title: state.title,
    updatedAt: now,
  };
}

