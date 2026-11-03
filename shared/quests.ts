/**
 * Quêtes journalières, hebdomadaires et missions de longue haleine.
 *
 * - Les quêtes du jour / de la semaine sont tirées de façon déterministe à partir de
 *   la période (même liste pour tout le monde), et leur progression repart de zéro
 *   à chaque nouvelle période (minuit UTC, lundi minuit UTC).
 * - La progression est comptée par le serveur pendant les actions (rolls, potions, fusions).
 * - Une récompense ne peut être réclamée qu'une fois : le marqueur « réclamé » est écrit
 *   dans la même écriture atomique que la récompense.
 */
import type { PotionId } from "./potions";
import type { RarityId } from "./rarities";
import type { PlayerState } from "./state";

export type QuestScope = "daily" | "weekly";

/** Compteurs suivis pendant une période. `tier:<rareté>` compte les auras de cette rareté ou mieux. */
export type QuestCounter =
  | "rolls"
  | "potions"
  | "blessed"
  | "discover"
  | "streak"
  | "xp"
  | "fusions"
  | "tier:rare"
  | "tier:epic"
  | "tier:legendary"
  | "tier:mythical";

export const TIER_COUNTERS: { key: QuestCounter; rarity: RarityId }[] = [
  { key: "tier:rare", rarity: "rare" },
  { key: "tier:epic", rarity: "epic" },
  { key: "tier:legendary", rarity: "legendary" },
  { key: "tier:mythical", rarity: "mythical" },
];

export type Reward = Partial<Record<PotionId, number>>;

export interface QuestDef {
  id: string;
  scope: QuestScope;
  name: string;
  description: string;
  counter: QuestCounter;
  target: number;
  reward: Reward;
}

export const QUESTS_PER_PERIOD = 3;

export const DAILY_QUESTS: readonly QuestDef[] = [
  { id: "d_rolls_200", scope: "daily", name: "Échauffement", description: "Lance 200 rolls.", counter: "rolls", target: 200, reward: { luck: 1 } },
  { id: "d_rolls_500", scope: "daily", name: "Marathon", description: "Lance 500 rolls.", counter: "rolls", target: 500, reward: { superLuck: 1 } },
  { id: "d_rare_5", scope: "daily", name: "Chasseur de reflets", description: "Obtiens 5 auras Rare ou mieux.", counter: "tier:rare", target: 5, reward: { luck: 1, speed: 1 } },
  { id: "d_epic_1", scope: "daily", name: "Éclat épique", description: "Obtiens une aura Epic ou mieux.", counter: "tier:epic", target: 1, reward: { superLuck: 1 } },
  { id: "d_potions_2", scope: "daily", name: "Dégustation", description: "Bois 2 potions.", counter: "potions", target: 2, reward: { luck: 2 } },
  { id: "d_blessed_10", scope: "daily", name: "Béni des dieux", description: "Lance 10 rolls bénis.", counter: "blessed", target: 10, reward: { blessing: 1 } },
  { id: "d_streak_100", scope: "daily", name: "Sans s'arrêter", description: "Atteins une série de 100 rolls.", counter: "streak", target: 100, reward: { streakGuard: 1 } },
  { id: "d_xp_500", scope: "daily", name: "Studieux", description: "Gagne 500 XP.", counter: "xp", target: 500, reward: { xpBoost: 1, luck: 1 } },
];

export const WEEKLY_QUESTS: readonly QuestDef[] = [
  { id: "w_rolls_4000", scope: "weekly", name: "Semaine acharnée", description: "Lance 4 000 rolls.", counter: "rolls", target: 4_000, reward: { hourglass: 2, superLuck: 1 } },
  { id: "w_legendary_1", scope: "weekly", name: "Trophée légendaire", description: "Obtiens une aura Legendary ou mieux.", counter: "tier:legendary", target: 1, reward: { focus: 2, hourglass: 1 } },
  { id: "w_epic_8", scope: "weekly", name: "Collection épique", description: "Obtiens 8 auras Epic ou mieux.", counter: "tier:epic", target: 8, reward: { superLuck: 2 } },
  { id: "w_discover_3", scope: "weekly", name: "Explorateur", description: "Découvre 3 nouvelles auras.", counter: "discover", target: 3, reward: { focus: 1, blessing: 2 } },
  { id: "w_potions_10", scope: "weekly", name: "Grand alchimiste", description: "Bois 10 potions.", counter: "potions", target: 10, reward: { hourglass: 1, purify: 1 } },
  { id: "w_streak_500", scope: "weekly", name: "Infatigable", description: "Atteins une série de 500 rolls.", counter: "streak", target: 500, reward: { streakGuard: 2, speed: 2 } },
  { id: "w_fusion_1", scope: "weekly", name: "Creuset", description: "Réalise une fusion.", counter: "fusions", target: 1, reward: { focus: 1, superLuck: 1 } },
  { id: "w_xp_5000", scope: "weekly", name: "Érudition", description: "Gagne 5 000 XP.", counter: "xp", target: 5_000, reward: { hourglass: 1, blessing: 1, xpBoost: 2 } },
];

const QUEST_BY_ID = new Map([...DAILY_QUESTS, ...WEEKLY_QUESTS].map((q) => [q.id, q]));

export function getQuest(id: string): QuestDef | undefined {
  return QUEST_BY_ID.get(id);
}

// ───────────── Périodes ─────────────

const DAY = 86_400_000;

export const dayKey = (now: number) => new Date(now).toISOString().slice(0, 10);

/** Index de semaine commençant le lundi (le 1er janvier 1970 était un jeudi). */
const weekIndex = (now: number) => Math.floor((Math.floor(now / DAY) + 3) / 7);
export const weekKey = (now: number) => `W${weekIndex(now)}`;

export function periodKey(scope: QuestScope, now: number): string {
  return scope === "daily" ? dayKey(now) : weekKey(now);
}

/** Instant (ms UTC) de la prochaine remise à zéro. */
export function periodEndsAt(scope: QuestScope, now: number): number {
  if (scope === "daily") return (Math.floor(now / DAY) + 1) * DAY;
  return ((weekIndex(now) + 1) * 7 - 3) * DAY;
}

/** Hachage FNV-1a 32 bits (déterministe, identique client/serveur). */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Quêtes actives d'une période : sélection déterministe sans doublon. */
export function questsFor(scope: QuestScope, key: string): QuestDef[] {
  const pool = [...(scope === "daily" ? DAILY_QUESTS : WEEKLY_QUESTS)];
  const out: QuestDef[] = [];
  let seed = hash(`${scope}:${key}`);
  while (out.length < QUESTS_PER_PERIOD && pool.length > 0) {
    seed = Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) >>> 0;
    out.push(pool.splice(seed % pool.length, 1)[0]);
  }
  return out;
}

export interface QuestPeriod {
  key: string;
  counters: Partial<Record<QuestCounter, number>>;
  /** Quêtes réclamées → date de réclamation. */
  claimed: Record<string, number>;
}

export function emptyPeriod(key: string): QuestPeriod {
  return { key, counters: {}, claimed: {} };
}

export function questProgress(q: QuestDef, period: QuestPeriod): number {
  return Math.min(q.target, period.counters[q.counter] ?? 0);
}

// ───────────── Missions ─────────────

export interface MissionDef {
  id: string;
  name: string;
  description: string;
  /** Valeur actuelle, lue dans l'état à vie du joueur. */
  value: (s: PlayerState) => number;
  stages: { target: number; reward: Reward }[];
}

export const MISSIONS: readonly MissionDef[] = [
  {
    id: "m_rolls",
    name: "Pèlerin du hasard",
    description: "Lance des rolls, encore et encore.",
    value: (s) => s.stats.rolls,
    stages: [
      { target: 1_000, reward: { luck: 3 } },
      { target: 10_000, reward: { superLuck: 3, focus: 1 } },
      { target: 50_000, reward: { hourglass: 3, blessing: 3 } },
      { target: 250_000, reward: { hourglass: 5, focus: 3 } },
      { target: 1_000_000, reward: { hourglass: 10, superLuck: 10 } },
    ],
  },
  {
    id: "m_codex",
    name: "Archiviste",
    description: "Découvre des auras différentes (le codex survit au prestige).",
    value: (s) => Object.keys(s.codex).length,
    stages: [
      { target: 10, reward: { luck: 2 } },
      { target: 25, reward: { superLuck: 2 } },
      { target: 40, reward: { focus: 2, hourglass: 1 } },
      { target: 55, reward: { hourglass: 3 } },
      { target: 65, reward: { hourglass: 5, blessing: 5 } },
    ],
  },
  {
    id: "m_quests",
    name: "Fidèle",
    description: "Réclame des quêtes journalières et hebdomadaires.",
    value: (s) => s.stats.questsClaimed,
    stages: [
      { target: 10, reward: { blessing: 2 } },
      { target: 50, reward: { focus: 2, superLuck: 2 } },
      { target: 150, reward: { hourglass: 5 } },
    ],
  },
  {
    id: "m_potions",
    name: "Apothicaire",
    description: "Bois des potions.",
    value: (s) => s.stats.potionsUsed,
    stages: [
      { target: 10, reward: { speed: 2 } },
      { target: 50, reward: { superLuck: 2, purify: 1 } },
      { target: 200, reward: { hourglass: 3, focus: 2 } },
    ],
  },
  {
    id: "m_prestige",
    name: "Ascension",
    description: "Renais grâce au prestige.",
    value: (s) => s.prestige.level,
    stages: [
      { target: 1, reward: { hourglass: 2 } },
      { target: 3, reward: { hourglass: 3, focus: 2 } },
      { target: 5, reward: { hourglass: 5, blessing: 5 } },
      { target: 10, reward: { hourglass: 10, superLuck: 10 } },
    ],
  },
  {
    id: "m_fusions",
    name: "Maître du creuset",
    description: "Réalise des fusions d'auras.",
    value: (s) => s.stats.fusions,
    stages: [
      { target: 1, reward: { focus: 1 } },
      { target: 5, reward: { focus: 2, superLuck: 2 } },
      { target: 20, reward: { hourglass: 3 } },
    ],
  },
];

export function getMission(id: string): MissionDef | undefined {
  return MISSIONS.find((m) => m.id === id);
}
