/**
 * Économie : les Éclats, monnaie gagnée en jouant, et la boutique qui les dépense.
 *
 * Règles anti-triche :
 * - aucun gain n'existe hors d'une action de jeu réelle (roll, quête, succès, prestige, fusion) :
 *   il n'y a pas d'action « gagner des éclats » ;
 * - le solde, le coût, le niveau et le plafond sont relus dans l'état stocké par le serveur ;
 * - chaque achat est appliqué dans la même écriture atomique que le débit (D1 compare-and-set).
 */
import type { PotionId } from "./potions";
import { getRarity, type RarityId } from "./rarities";

export const CURRENCY = { name: "Éclats", singular: "éclat", plural: "éclats", short: "✦" } as const;

/**
 * Solde maximal : au-delà, les gains sont perdus (évite les débordements et l'accumulation infinie).
 * 2 milliards : assez pour acheter au marché une aura Beyond (prix plancher 800 M).
 */
export const SHARD_CAP = 2_000_000_000;

// ───────────── Gains ─────────────

/** Éclats d'un roll selon le rang de rareté (0 = Common … 14 = Beyond). */
export const SHARDS_BY_TIER = [1, 2, 4, 8, 20, 50, 80, 120, 250, 400, 600, 900, 1_500, 3_000, 5_000];
/** +1 éclat par tranche de 50 rolls de série, plafonné. */
export const STREAK_SHARD_STEP = 50;
export const STREAK_SHARD_MAX = 5;
/** Un roll béni double ses éclats. */
export const BLESSED_SHARD_MUL = 2;
/** Première découverte : bonus = DISCOVERY_SHARDS × (rang + 1). */
export const DISCOVERY_SHARDS = 10;
export const QUEST_SHARDS = { daily: 25, weekly: 120 } as const;
/** Étape de mission n (0-based) : MISSION_SHARDS × (n + 1). */
export const MISSION_SHARDS = 60;
export const ACHIEVEMENT_SHARDS = 30;
export const SECRET_ACHIEVEMENT_SHARDS = 100;
/** Renaissance n : PRESTIGE_SHARDS × n. */
export const PRESTIGE_SHARDS = 500;

export function rollShards(rarity: RarityId, streak: number, blessed: boolean, isNew: boolean): number {
  const tier = getRarity(rarity).tier;
  const base = SHARDS_BY_TIER[tier] ?? SHARDS_BY_TIER[SHARDS_BY_TIER.length - 1];
  const streakBonus = Math.min(STREAK_SHARD_MAX, Math.floor(Math.max(0, streak) / STREAK_SHARD_STEP));
  const discovery = isNew ? DISCOVERY_SHARDS * (tier + 1) : 0;
  return (base + streakBonus) * (blessed ? BLESSED_SHARD_MUL : 1) + discovery;
}

// ───────────── Améliorations permanentes ─────────────

export type UpgradeId = "clockwork" | "clover" | "tenacity" | "halo" | "alembic" | "slot";
export type ShopCategory = "recharge" | "chance" | "potions" | "cosmetique";

export interface Upgrade {
  id: UpgradeId;
  name: string;
  description: string;
  category: ShopCategory;
  maxLevel: number;
  /** Coût du niveau `level` → `level + 1`. */
  cost: (level: number) => number;
}

const geometric = (base: number, growth: number) => (level: number) => Math.round(base * Math.pow(growth, level));

export const UPGRADES: readonly Upgrade[] = [
  {
    id: "clockwork",
    name: "Mécanisme d'horlogerie",
    description: "Réduit le temps de recharge entre deux rolls de 2 % par niveau.",
    category: "recharge",
    maxLevel: 10,
    cost: geometric(150, 1.55),
  },
  {
    id: "clover",
    name: "Trèfle doré",
    description: "Ajoute +2 % de chance permanente par niveau.",
    category: "chance",
    maxLevel: 20,
    cost: geometric(200, 1.4),
  },
  {
    id: "tenacity",
    name: "Ténacité",
    description: "Relève le plafond du bonus de série de +4 % par niveau.",
    category: "chance",
    maxLevel: 5,
    cost: geometric(400, 1.8),
  },
  {
    id: "halo",
    name: "Auréole",
    description: "Le roll béni arrive 1 roll plus tôt par niveau.",
    category: "chance",
    maxLevel: 2,
    cost: geometric(3_000, 4),
  },
  {
    id: "alembic",
    name: "Alambic",
    description: "Les potions durent 5 % plus longtemps par niveau.",
    category: "potions",
    maxLevel: 10,
    cost: geometric(180, 1.5),
  },
  {
    id: "slot",
    name: "Écrin supplémentaire",
    description: "Un emplacement d'aura de plus, en plus de ceux du niveau.",
    category: "cosmetique",
    maxLevel: 1,
    cost: () => 25_000,
  },
];

export const UPGRADE_IDS = UPGRADES.map((u) => u.id);
const UPGRADE_BY_ID = new Map(UPGRADES.map((u) => [u.id, u]));

export function getUpgrade(id: UpgradeId): Upgrade {
  const u = UPGRADE_BY_ID.get(id);
  if (!u) throw new Error(`Amélioration inconnue : ${id}`);
  return u;
}

export function isUpgradeId(v: unknown): v is UpgradeId {
  return typeof v === "string" && UPGRADE_BY_ID.has(v as UpgradeId);
}

export type UpgradeLevels = Record<UpgradeId, number>;

export function emptyUpgrades(): UpgradeLevels {
  return Object.fromEntries(UPGRADE_IDS.map((id) => [id, 0])) as UpgradeLevels;
}

// Effets (lus par luck.ts, engine.ts et progression.ts : une seule source de vérité)
export const upgradeCooldownMul = (u: UpgradeLevels) => 1 - 0.02 * (u.clockwork ?? 0);
export const upgradeLuckBonus = (u: UpgradeLevels) => 0.02 * (u.clover ?? 0);
export const upgradeStreakCapBonus = (u: UpgradeLevels) => 0.04 * (u.tenacity ?? 0);
export const upgradeBlessedReduction = (u: UpgradeLevels) => u.halo ?? 0;
export const upgradePotionDurationMul = (u: UpgradeLevels) => 1 + 0.05 * (u.alembic ?? 0);
export const upgradeExtraSlots = (u: UpgradeLevels) => u.slot ?? 0;

// ───────────── Potions en boutique ─────────────

/** Prix d'une potion à l'unité. */
export const POTION_PRICES: Record<PotionId, number> = {
  luck: 60,
  speed: 80,
  superLuck: 250,
  hourglass: 400,
  focus: 500,
  streakGuard: 180,
  blessing: 150,
  purify: 120,
  xpBoost: 150,
};

/** Lots à prix réduit (quantité exacte → prix total). */
export const POTION_PACKS: Partial<Record<PotionId, { quantity: number; price: number }>> = {
  xpBoost: { quantity: 10, price: 1_350 },
};

/** Prix total d'un achat de potions (lot à prix réduit si la quantité correspond). */
export function potionPrice(id: PotionId, quantity: number): number {
  const pack = POTION_PACKS[id];
  if (pack && quantity === pack.quantity) return pack.price;
  return POTION_PRICES[id] * quantity;
}
/** Au-delà de ce stock, la boutique refuse de vendre la potion (évite d'immobiliser le solde). */
export const POTION_STOCK_LIMIT = 99;
export const MAX_POTIONS_PER_PURCHASE = 10;

// ───────────── Cosmétiques ─────────────

export type CosmeticKind = "trail" | "frame";
export type CosmeticId =
  | "trail_stardust"
  | "trail_embers"
  | "trail_petals"
  | "trail_prism"
  | "frame_gold"
  | "frame_neon"
  | "frame_cosmic"
  | "frame_void";

export interface Cosmetic {
  id: CosmeticId;
  kind: CosmeticKind;
  name: string;
  description: string;
  price: number;
  colors: string[];
}

export const COSMETICS: readonly Cosmetic[] = [
  { id: "trail_stardust", kind: "trail", name: "Poussière d'étoiles", description: "Une traînée scintillante suit ton curseur.", price: 1_500, colors: ["#ffffff", "#c9d6ff", "#7af5ff"] },
  { id: "trail_embers", kind: "trail", name: "Braises", description: "Des braises chaudes s'échappent de ton curseur.", price: 2_500, colors: ["#ffd36b", "#ff8a3d", "#ff2e4d"] },
  { id: "trail_petals", kind: "trail", name: "Pétales", description: "Des pétales roses tombent dans ton sillage.", price: 2_500, colors: ["#ffc2ec", "#ff8ad8", "#ffffff"] },
  { id: "trail_prism", kind: "trail", name: "Prisme", description: "Une traînée arc-en-ciel, toutes les couleurs à la fois.", price: 8_000, colors: ["#ff6b6b", "#ffd36b", "#6bff9e", "#6bc4ff", "#c46bff"] },
  { id: "frame_gold", kind: "frame", name: "Cadre doré", description: "Un liseré d'or autour de ton avatar et de ton profil.", price: 2_000, colors: ["#ffd36b", "#ffb13d"] },
  { id: "frame_neon", kind: "frame", name: "Cadre néon", description: "Un néon cyan et violet qui pulse doucement.", price: 4_000, colors: ["#3ee0ff", "#9b6bff"] },
  { id: "frame_cosmic", kind: "frame", name: "Cadre cosmique", description: "Un anneau d'étoiles qui tourne lentement.", price: 12_000, colors: ["#ffffff", "#c49bff", "#3dc8ff"] },
  { id: "frame_void", kind: "frame", name: "Cadre du Vide", description: "Un anneau d'obscurité bordé de lumière violette.", price: 30_000, colors: ["#8c7bff", "#000000"] },
];

const COSMETIC_BY_ID = new Map(COSMETICS.map((c) => [c.id, c]));

export function getCosmetic(id: CosmeticId): Cosmetic {
  const c = COSMETIC_BY_ID.get(id);
  if (!c) throw new Error(`Cosmétique inconnu : ${id}`);
  return c;
}

export function isCosmeticId(v: unknown): v is CosmeticId {
  return typeof v === "string" && COSMETIC_BY_ID.has(v as CosmeticId);
}

// ───────────── Historique ─────────────

export interface LedgerEntry {
  at: number;
  /** Positif = gain, négatif = dépense. */
  amount: number;
  reason: string;
  balance: number;
}

export const LEDGER_LIMIT = 40;
