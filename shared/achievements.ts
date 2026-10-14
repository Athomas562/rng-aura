import { AURAS, getAura } from "./auras";
import type { PotionId } from "./potions";
import { getRarity, type RarityId } from "./rarities";
import type { PlayerState } from "./state";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  /** Masqué tant qu'il n'est pas débloqué. */
  secret?: boolean;
  reward?: Partial<Record<PotionId, number>>;
  /** [valeur actuelle, objectif] — l'objectif est atteint quand actuelle ≥ objectif. */
  progress: (s: PlayerState) => [number, number];
}

function bestTier(s: PlayerState): number {
  let best = -1;
  for (const id of Object.keys(s.inventory)) {
    const aura = getAura(id);
    if (aura) best = Math.max(best, getRarity(aura.rarity).tier);
  }
  return best;
}

const rolls = (target: number) => (s: PlayerState): [number, number] => [s.stats.rolls, target];
const tierReached = (rarity: RarityId) => (s: PlayerState): [number, number] => [
  bestTier(s) >= getRarity(rarity).tier ? 1 : 0,
  1,
];
const collection = (target: number) => (s: PlayerState): [number, number] => [
  Object.keys(s.inventory).length,
  target,
];
const HOUR = 3_600_000;

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: "first_roll", name: "Premier roll", description: "Lance ton tout premier roll.", reward: { luck: 1 }, progress: rolls(1) },
  { id: "rolls_100", name: "Habitué", description: "Lance 100 rolls.", reward: { speed: 1 }, progress: rolls(100) },
  { id: "rolls_1000", name: "Acharné", description: "Lance 1 000 rolls.", reward: { superLuck: 1 }, progress: rolls(1_000) },
  { id: "rolls_10000", name: "Machine à rolls", description: "Lance 10 000 rolls.", reward: { hourglass: 2 }, progress: rolls(10_000) },
  { id: "rolls_100000", name: "Obsession", description: "Lance 100 000 rolls.", reward: { superLuck: 5 }, progress: rolls(100_000) },

  { id: "first_rare", name: "Ça brille", description: "Obtiens une aura Rare ou mieux.", reward: { luck: 1 }, progress: tierReached("rare") },
  { id: "first_epic", name: "Épique !", description: "Obtiens une aura Epic ou mieux.", reward: { luck: 2 }, progress: tierReached("epic") },
  { id: "first_legendary", name: "Première aura légendaire", description: "Obtiens une aura Legendary ou mieux.", reward: { superLuck: 1 }, progress: tierReached("legendary") },
  { id: "first_mythical", name: "Mythe vivant", description: "Obtiens une aura Mythical ou mieux.", reward: { hourglass: 1, superLuck: 1 }, progress: tierReached("mythical") },
  { id: "first_divine", name: "Touché par le divin", description: "Obtiens une aura Divine ou mieux.", reward: { hourglass: 2 }, progress: tierReached("divine") },
  { id: "first_celestial", name: "Au-delà des étoiles", description: "Obtiens une aura Celestial ou mieux.", reward: { hourglass: 3 }, progress: tierReached("celestial") },
  { id: "beyond", name: "Au-delà du possible", description: "Obtiens une aura Transcendent ou Infinity.", secret: true, reward: { superLuck: 5, hourglass: 5 }, progress: tierReached("transcendent") },

  { id: "collect_10", name: "Apprenti collectionneur", description: "Découvre 10 auras différentes.", reward: { luck: 2 }, progress: collection(10) },
  { id: "collect_20", name: "Collectionneur", description: "Découvre 20 auras différentes.", reward: { superLuck: 2 }, progress: collection(20) },
  { id: "collect_all", name: "Catalogue complet", description: "Découvre toutes les auras du jeu.", secret: true, progress: collection(AURAS.length) },

  { id: "streak_100", name: "Main chaude", description: "Atteins une série de 100 rolls.", reward: { speed: 2 }, progress: (s) => [s.stats.maxStreak, 100] },
  { id: "streak_1000", name: "Inarrêtable", description: "Atteins une série de 1 000 rolls.", reward: { hourglass: 1 }, progress: (s) => [s.stats.maxStreak, 1_000] },

  { id: "potion_1", name: "Alchimiste", description: "Bois ta première potion.", reward: { luck: 1 }, progress: (s) => [s.stats.potionsUsed, 1] },
  { id: "potion_25", name: "Maître alchimiste", description: "Bois 25 potions.", reward: { superLuck: 2 }, progress: (s) => [s.stats.potionsUsed, 25] },

  { id: "playtime_1h", name: "Dévoué", description: "Joue pendant 1 heure.", reward: { speed: 1, luck: 1 }, progress: (s) => [s.stats.playTimeMs, HOUR] },
  { id: "playtime_10h", name: "Insomniaque", description: "Joue pendant 10 heures.", reward: { hourglass: 2 }, progress: (s) => [s.stats.playTimeMs, 10 * HOUR] },

  {
    id: "dupes_100",
    name: "Déjà-vu",
    description: "Obtiens la même aura 100 fois.",
    reward: { luck: 2 },
    progress: (s) => [Math.max(0, ...Object.values(s.inventory).map((e) => e.count)), 100],
  },
];

export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

export function isAchievementMet(a: Achievement, s: PlayerState): boolean {
  const [cur, target] = a.progress(s);
  return cur >= target;
}
