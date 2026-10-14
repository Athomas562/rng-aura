import { getAura } from "./auras";
import { POTION_IDS, type PotionId } from "./potions";

export interface InventoryEntry {
  count: number;
  firstAt: number;
  lastAt: number;
}

export interface RecentRoll {
  auraId: string;
  at: number;
  luck: number;
}

export interface PlayerStats {
  rolls: number;
  playTimeMs: number;
  /** Dernière activité (roll ou heartbeat) prise en compte dans le temps de jeu. */
  lastActiveAt: number;
  lastRollAt: number;
  /** Horloge du seau à jetons des rolls (voir luck.ts). */
  rollClock: number;
  streak: number;
  maxStreak: number;
  bestAuraId: string | null;
  potionsUsed: number;
}

export interface PlayerState {
  version: 2;
  name: string;
  createdAt: number;
  equipped: string | null;
  inventory: Record<string, InventoryEntry>;
  stats: PlayerStats;
  potions: {
    owned: Record<PotionId, number>;
    /** Timestamp de fin de chaque potion active. */
    active: Partial<Record<PotionId, number>>;
  };
  achievements: Record<string, number>;
  recent: RecentRoll[];
}

export const RECENT_LIMIT = 12;
export const STARTER_POTIONS: Partial<Record<PotionId, number>> = { luck: 2, speed: 1 };

export function emptyPotionCounts(): Record<PotionId, number> {
  return Object.fromEntries(POTION_IDS.map((id) => [id, 0])) as Record<PotionId, number>;
}

export function createPlayerState(name: string, now: number): PlayerState {
  const owned = emptyPotionCounts();
  for (const [id, n] of Object.entries(STARTER_POTIONS)) owned[id as PotionId] = n ?? 0;
  return {
    version: 2,
    name,
    createdAt: now,
    equipped: null,
    inventory: {},
    stats: {
      rolls: 0,
      playTimeMs: 0,
      lastActiveAt: 0,
      lastRollAt: 0,
      rollClock: 0,
      streak: 0,
      maxStreak: 0,
      bestAuraId: null,
      potionsUsed: 0,
    },
    potions: { owned, active: {} },
    achievements: {},
    recent: [],
  };
}

const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

/**
 * Reconstruit un état complet et valide à partir de données brutes
 * (la Realtime Database supprime les objets vides et peut renvoyer des tableaux).
 * Les auras inconnues du catalogue sont ignorées.
 */
export function normalizePlayerState(raw: unknown, fallbackName: string, now: number): PlayerState {
  const base = createPlayerState(fallbackName, now);
  if (!raw || typeof raw !== "object") return base;
  const r = obj(raw);

  const inventory: Record<string, InventoryEntry> = {};
  for (const [id, e] of Object.entries(obj(r.inventory))) {
    if (!getAura(id)) continue;
    const entry = obj(e);
    const count = Math.max(0, Math.floor(num(entry.count)));
    if (count > 0) inventory[id] = { count, firstAt: num(entry.firstAt), lastAt: num(entry.lastAt) };
  }

  const s = obj(r.stats);
  const bestAuraId = typeof s.bestAuraId === "string" && inventory[s.bestAuraId] ? s.bestAuraId : null;
  const stats: PlayerStats = {
    rolls: num(s.rolls),
    playTimeMs: num(s.playTimeMs),
    lastActiveAt: num(s.lastActiveAt),
    lastRollAt: num(s.lastRollAt),
    rollClock: num(s.rollClock),
    streak: num(s.streak),
    maxStreak: num(s.maxStreak),
    bestAuraId,
    potionsUsed: num(s.potionsUsed),
  };

  const p = obj(r.potions);
  const ownedRaw = obj(p.owned);
  const activeRaw = obj(p.active);
  const owned = emptyPotionCounts();
  const active: Partial<Record<PotionId, number>> = {};
  for (const id of POTION_IDS) {
    owned[id] = Math.max(0, Math.floor(num(ownedRaw[id])));
    const until = num(activeRaw[id]);
    if (until > 0) active[id] = until;
  }

  const achievements: Record<string, number> = {};
  for (const [id, at] of Object.entries(obj(r.achievements))) achievements[id] = num(at);

  const recentRaw = Array.isArray(r.recent) ? r.recent : Object.values(obj(r.recent));
  const recent: RecentRoll[] = recentRaw
    .map((x) => obj(x))
    .filter((x) => typeof x.auraId === "string" && getAura(x.auraId as string))
    .map((x) => ({ auraId: x.auraId as string, at: num(x.at), luck: num(x.luck, 1) }))
    .slice(0, RECENT_LIMIT);

  const equipped = typeof r.equipped === "string" && inventory[r.equipped] ? r.equipped : null;

  return {
    version: 2,
    name: typeof r.name === "string" && r.name ? r.name : fallbackName,
    createdAt: num(r.createdAt, now),
    equipped,
    inventory,
    stats,
    potions: { owned, active },
    achievements,
    recent,
  };
}

export function discoveredCount(state: PlayerState): number {
  return Object.keys(state.inventory).length;
}
