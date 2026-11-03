/**
 * Niveau de joueur (XP), titres, emplacements d'aura et prestige.
 * Toutes les valeurs sont calculées par le serveur à partir de l'état stocké.
 */
import { getAura } from "./auras";
import { upgradeExtraSlots } from "./economy";
import type { PotionId } from "./potions";
import { getRarity, tierOf, type RarityId } from "./rarities";
import type { PlayerState } from "./state";

// ───────────── XP et niveau ─────────────

export const MAX_LEVEL = 100;
/** XP d'un roll selon le rang de rareté de l'aura obtenue. */
export const XP_BY_TIER = [1, 2, 4, 8, 16, 32, 40, 48, 64, 80, 96, 120, 160, 220, 300];
/** Une première découverte rapporte ce multiple de l'XP normale. */
export const DISCOVERY_XP_MUL = 10;

export function xpForRarity(rarity: RarityId): number {
  return XP_BY_TIER[getRarity(rarity).tier] ?? XP_BY_TIER[XP_BY_TIER.length - 1];
}

/** XP nécessaire pour passer du niveau `level` au suivant. */
export function xpToNext(level: number): number {
  return Math.round(25 * Math.pow(level, 1.5));
}

export interface LevelInfo {
  level: number;
  /** XP accumulée dans le niveau courant. */
  into: number;
  /** XP nécessaire pour le niveau suivant (0 au niveau maximal). */
  need: number;
}

export function levelInfo(xp: number): LevelInfo {
  let level = 1;
  let rest = Math.max(0, Math.floor(xp));
  while (level < MAX_LEVEL && rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level++;
  }
  return { level, into: rest, need: level >= MAX_LEVEL ? 0 : xpToNext(level) };
}

export const levelOf = (s: PlayerState): number => levelInfo(s.xp).level;

// ───────────── Emplacements d'aura ─────────────

/** Niveaux qui débloquent un emplacement d'aura supplémentaire. */
export const SLOT_LEVELS = [10, 25, 50];

export function slotsFor(level: number): number {
  return 1 + SLOT_LEVELS.filter((l) => level >= l).length;
}

/** Emplacements d'aura du joueur : niveau + Écrin acheté en boutique. */
export function slotCount(s: PlayerState): number {
  return slotsFor(levelOf(s)) + upgradeExtraSlots(s.upgrades);
}

// ───────────── Talents ─────────────

export const TALENT_POINTS_PER_PRESTIGE = 2;

export function talentPointsFor(s: PlayerState): number {
  return levelOf(s) - 1 + s.prestige.level * TALENT_POINTS_PER_PRESTIGE;
}

// ───────────── Prestige ─────────────

/** Rolls à lancer depuis le dernier prestige pour pouvoir renaître. */
export const PRESTIGE_ROLLS = 10_000;
export const PRESTIGE_MAX = 10;
/** Bonus de chance additif permanent par prestige. */
export const PRESTIGE_LUCK = 0.05;
/** Potions offertes à chaque renaissance. */
export const PRESTIGE_REWARD: Partial<Record<PotionId, number>> = { superLuck: 2, hourglass: 1, blessing: 2, xpBoost: 2 };

export const runRolls = (s: PlayerState): number => s.stats.rolls - s.prestige.runStartRolls;

export function canPrestige(s: PlayerState): boolean {
  return s.prestige.level < PRESTIGE_MAX && runRolls(s) >= PRESTIGE_ROLLS;
}

// ───────────── Titres ─────────────

export interface Title {
  id: string;
  name: string;
  /** Condition affichée tant que le titre est verrouillé. */
  requirement: string;
  color: string;
  unlocked: (s: PlayerState) => boolean;
}

function codexHasTier(s: PlayerState, rarity: RarityId): boolean {
  return Object.keys(s.codex).some((id) => {
    const a = getAura(id);
    return a !== undefined && a.rarity === rarity;
  });
}

const atLevel = (n: number) => (s: PlayerState) => levelOf(s) >= n;
const atPrestige = (n: number) => (s: PlayerState) => s.prestige.level >= n;

export const TITLES: readonly Title[] = [
  { id: "novice", name: "Novice", requirement: "Disponible dès le départ", color: "#a3b1c6", unlocked: () => true },
  { id: "apprenti", name: "Apprenti", requirement: "Niveau 5", color: "#5ee6a0", unlocked: atLevel(5) },
  { id: "chercheur", name: "Chercheur d'auras", requirement: "Niveau 10", color: "#4cc3ff", unlocked: atLevel(10) },
  { id: "mystique", name: "Mystique", requirement: "Niveau 20", color: "#b072ff", unlocked: atLevel(20) },
  { id: "archimage", name: "Archimage", requirement: "Niveau 35", color: "#ffc94d", unlocked: atLevel(35) },
  { id: "legende", name: "Légende vivante", requirement: "Niveau 50", color: "#ff4d7e", unlocked: atLevel(50) },
  { id: "mythe", name: "Mythe", requirement: "Niveau 75", color: "#fff2a8", unlocked: atLevel(75) },
  { id: "eternel", name: "Éternel", requirement: "Niveau 100", color: "#ffffff", unlocked: atLevel(100) },
  { id: "ressuscite", name: "Ressuscité", requirement: "Prestige 1", color: "#ff9d3d", unlocked: atPrestige(1) },
  { id: "phenix_eternel", name: "Phénix éternel", requirement: "Prestige 5", color: "#ff6b3d", unlocked: atPrestige(5) },
  { id: "ascendant", name: "Ascendant", requirement: "Prestige 10", color: "#e3a6ff", unlocked: atPrestige(10) },
  { id: "corrompu", name: "Corrompu", requirement: "Découvrir une aura Corrupted", color: "#39ff88", unlocked: (s) => codexHasTier(s, "corrupted") },
  { id: "reveur", name: "Rêveur", requirement: "Découvrir une aura Dream", color: "#ffb8f0", unlocked: (s) => codexHasTier(s, "dream") },
  { id: "enfant_vide", name: "Enfant du Vide", requirement: "Découvrir une aura Void", color: "#8c7bff", unlocked: (s) => codexHasTier(s, "void") },
  { id: "au_dela", name: "Au-delà", requirement: "Découvrir une aura Beyond", color: "#f4f4f4", unlocked: (s) => codexHasTier(s, "beyond") },
  { id: "alchimiste", name: "Alchimiste", requirement: "Réaliser une fusion", color: "#ff7ad9", unlocked: (s) => s.stats.fusions >= 1 },
  { id: "assidu", name: "Assidu", requirement: "Réclamer 50 quêtes", color: "#7af5ff", unlocked: (s) => s.stats.questsClaimed >= 50 },
];

export function getTitle(id: string): Title | undefined {
  return TITLES.find((t) => t.id === id);
}

/** Rang de rareté le plus élevé jamais découvert (−1 si aucun). */
export function bestCodexTier(s: PlayerState): number {
  let best = -1;
  for (const id of Object.keys(s.codex)) {
    const a = getAura(id);
    if (a) best = Math.max(best, getRarity(a.rarity).tier);
  }
  return best;
}

export const reachedTier = (s: PlayerState, rarity: RarityId) => bestCodexTier(s) >= tierOf(rarity);
