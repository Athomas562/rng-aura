import { AURAS, getAura, type AuraSpecialKind } from "./auras";
import type { PotionId } from "./potions";
import { bestCodexTier, levelOf } from "./progression";
import { tierOf, type RarityId } from "./rarities";
import type { PlayerState } from "./state";
import { TALENTS } from "./talents";

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

const rolls = (target: number) => (s: PlayerState): [number, number] => [s.stats.rolls, target];
/** Une aura de ce rang de rareté ou mieux, découverte un jour (codex). */
const tierReached = (rarity: RarityId) => (s: PlayerState): [number, number] => [bestCodexTier(s) >= tierOf(rarity) ? 1 : 0, 1];
/** Une aura de cette rareté précise (paliers « branche »). */
const hasRarity = (rarity: RarityId) => (s: PlayerState): [number, number] => [
  Object.keys(s.codex).some((id) => getAura(id)?.rarity === rarity) ? 1 : 0,
  1,
];
const hasSpecial = (kind: AuraSpecialKind) => (s: PlayerState): [number, number] => [
  Object.keys(s.codex).some((id) => getAura(id)?.special?.kind === kind) ? 1 : 0,
  1,
];
const collection = (target: number) => (s: PlayerState): [number, number] => [Object.keys(s.codex).length, target];
const level = (target: number) => (s: PlayerState): [number, number] => [levelOf(s), target];
const prestige = (target: number) => (s: PlayerState): [number, number] => [s.prestige.level, target];
const HOUR = 3_600_000;
const SPECIAL_KINDS: AuraSpecialKind[] = ["echo", "mimic", "seasonal", "fusion", "cursed", "living"];

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
  { id: "beyond", name: "Au-delà du possible", description: "Obtiens une aura Transcendent ou plus rare.", secret: true, reward: { superLuck: 5, hourglass: 5 }, progress: tierReached("transcendent") },
  { id: "first_infinity", name: "Vers l'infini", description: "Obtiens une aura Infinity ou plus rare.", secret: true, reward: { hourglass: 5, focus: 3 }, progress: tierReached("infinity") },

  // Raretés « branche » et extrêmes
  { id: "first_corrupted", name: "Erreur système", description: "Obtiens une aura Corrupted.", reward: { hourglass: 1, purify: 1 }, progress: hasRarity("corrupted") },
  { id: "first_primordial", name: "Aux origines", description: "Obtiens une aura Primordial.", reward: { hourglass: 3, focus: 1 }, progress: hasRarity("primordial") },
  { id: "first_dream", name: "Fais de beaux rêves", description: "Obtiens une aura Dream.", secret: true, reward: { hourglass: 3, blessing: 3 }, progress: hasRarity("dream") },
  { id: "first_void", name: "Regard dans l'abîme", description: "Obtiens une aura Void.", secret: true, reward: { hourglass: 8, focus: 3 }, progress: hasRarity("void") },
  { id: "first_beyond", name: "Illisible", description: "Obtiens une aura Beyond.", secret: true, reward: { hourglass: 10, superLuck: 10 }, progress: hasRarity("beyond") },

  // Auras spéciales
  { id: "special_echo", name: "Ça change tout le temps", description: "Obtiens l'Écho fractal.", reward: { luck: 2 }, progress: hasSpecial("echo") },
  { id: "special_mimic", name: "Qui suis-je ?", description: "Obtiens Mimique.", reward: { superLuck: 1 }, progress: hasSpecial("mimic") },
  { id: "special_cursed", name: "Porte-malheur", description: "Obtiens la Marque maudite.", reward: { purify: 2 }, progress: hasSpecial("cursed") },
  { id: "special_seasonal", name: "De saison", description: "Obtiens une aura saisonnière pendant un événement.", reward: { focus: 1 }, progress: hasSpecial("seasonal") },
  { id: "special_living", name: "Main verte", description: "Obtiens Yggdrasil, l'aura vivante.", reward: { superLuck: 1 }, progress: hasSpecial("living") },
  {
    id: "living_max",
    name: "Arbre-monde",
    description: "Fais grandir Yggdrasil jusqu'à son 5e stade (50 000 rolls après son obtention).",
    reward: { hourglass: 3 },
    progress: (s) => {
      const e = s.inventory.yggdrasil;
      return [e ? Math.max(0, s.stats.rolls - e.firstRoll) : 0, 50_000];
    },
  },
  { id: "special_all", name: "Collection insolite", description: "Possède une aura de chaque mécanique spéciale (6).", reward: { hourglass: 2, focus: 2 }, progress: (s) => [SPECIAL_KINDS.filter((k) => hasSpecial(k)(s)[0]).length, SPECIAL_KINDS.length] },
  { id: "fusion_1", name: "Premier creuset", description: "Réalise ta première fusion.", reward: { focus: 1 }, progress: (s) => [s.stats.fusions, 1] },
  { id: "fusion_10", name: "Maître fondeur", description: "Réalise 10 fusions.", reward: { hourglass: 2 }, progress: (s) => [s.stats.fusions, 10] },

  { id: "collect_10", name: "Apprenti collectionneur", description: "Découvre 10 auras différentes.", reward: { luck: 2 }, progress: collection(10) },
  { id: "collect_20", name: "Collectionneur", description: "Découvre 20 auras différentes.", reward: { superLuck: 2 }, progress: collection(20) },
  { id: "collect_40", name: "Grand collectionneur", description: "Découvre 40 auras différentes.", reward: { hourglass: 2, focus: 1 }, progress: collection(40) },
  { id: "collect_all", name: "Catalogue complet", description: "Découvre toutes les auras du jeu.", secret: true, progress: collection(AURAS.length) },

  // Progression
  { id: "level_10", name: "Initié", description: "Atteins le niveau 10.", reward: { superLuck: 1, xpBoost: 1 }, progress: level(10) },
  { id: "level_25", name: "Adepte", description: "Atteins le niveau 25.", reward: { hourglass: 1, focus: 1, xpBoost: 2 }, progress: level(25) },
  { id: "level_50", name: "Maître des auras", description: "Atteins le niveau 50.", reward: { hourglass: 3 }, progress: level(50) },
  { id: "level_100", name: "Sommet", description: "Atteins le niveau 100.", secret: true, reward: { hourglass: 10 }, progress: level(100) },
  { id: "prestige_1", name: "Renaissance", description: "Effectue ton premier prestige.", reward: { hourglass: 2 }, progress: prestige(1) },
  { id: "prestige_5", name: "Cycle éternel", description: "Atteins le prestige 5.", reward: { hourglass: 5 }, progress: prestige(5) },
  { id: "prestige_10", name: "Ascension ultime", description: "Atteins le prestige maximal (10).", secret: true, reward: { hourglass: 10, focus: 5 }, progress: prestige(10) },
  {
    id: "talents_all",
    name: "Arbre complet",
    description: "Monte tous les talents à leur rang maximal.",
    reward: { hourglass: 3 },
    progress: (s) => [TALENTS.reduce((n, t) => n + (s.talents[t.id] ?? 0), 0), TALENTS.reduce((n, t) => n + t.maxRank, 0)],
  },
  { id: "quests_10", name: "Fiable", description: "Réclame 10 quêtes.", reward: { blessing: 2 }, progress: (s) => [s.stats.questsClaimed, 10] },
  { id: "quests_100", name: "Pilier", description: "Réclame 100 quêtes.", reward: { hourglass: 3 }, progress: (s) => [s.stats.questsClaimed, 100] },
  { id: "blessed_100", name: "Béni", description: "Lance 100 rolls bénis.", reward: { blessing: 2 }, progress: (s) => [s.stats.blessedRolls, 100] },

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
    progress: (s) => [Math.max(0, ...Object.values(s.codex).map((e) => e.total)), 100],
  },
];

export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

export function isAchievementMet(a: Achievement, s: PlayerState): boolean {
  const [cur, target] = a.progress(s);
  return cur >= target;
}
