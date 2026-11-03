import { getAura } from "./auras";
import {
  COSMETICS,
  LEDGER_LIMIT,
  SHARD_CAP,
  UPGRADES,
  emptyUpgrades,
  getCosmetic,
  isCosmeticId,
  type CosmeticId,
  type LedgerEntry,
  type UpgradeLevels,
} from "./economy";
import { POTION_IDS, type PotionId } from "./potions";
import { isSecretAchievement, HINT_LEVELS } from "./hints";
import { emptyPeriod, type QuestCounter, type QuestPeriod } from "./quests";
import { isRarityId, type RarityId } from "./rarities";
import { TALENTS, emptyTalents, type TalentRanks } from "./talents";

export interface InventoryEntry {
  count: number;
  firstAt: number;
  lastAt: number;
  /** Numéro du roll de la première obtention dans la partie en cours (auras vivantes). */
  firstRoll: number;
  /** Exemplaires obtenus par échange (marché, trade) : badge, hors codex et hors record de rareté. */
  traded?: number;
}

/** Auras en dépôt (vente en cours, échange confirmé) : hors de l'inventaire jusqu'au dénouement. */
export interface EscrowEntry {
  kind: "listing" | "trade";
  auras: { auraId: string; traded: boolean }[];
  at: number;
  /** Prix de l'annonce (0 pour un échange). */
  price: number;
  /** Version de l'échange confirmée (0 pour une annonce). */
  version: number;
}

/** Codex : toutes les auras découvertes un jour, conservé au prestige. */
export interface CodexEntry {
  firstAt: number;
  /** Nombre total d'obtentions, toutes parties confondues. */
  total: number;
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
  blessedRolls: number;
  fusions: number;
  questsClaimed: number;
  shardsEarned: number;
  shardsSpent: number;
  /** Ventes, achats et échanges aboutis. */
  marketDeals: number;
  /** Fin de la dernière potion de série : la série est gelée jusque-là, puis la fenêtre repart de cet instant. */
  streakGuardEnd: number;
}

export interface PrestigeRecord {
  at: number;
  /** Niveau de prestige atteint par cette renaissance. */
  level: number;
  runRolls: number;
  /** Aura la plus rare possédée juste avant la renaissance. */
  bestAuraId: string | null;
  collection: number;
}

export interface PlayerState {
  version: 2;
  /** Révision : +1 à chaque écriture serveur. Le client n'affiche jamais un état de révision inférieure. */
  rev: number;
  /** Identifiants des dernières requêtes de roll traitées (idempotence : un doublon n'est pas rejoué). */
  requestIds: string[];
  name: string;
  createdAt: number;
  /** Aura principale (avatar, classement). */
  equipped: string | null;
  /** Emplacements supplémentaires débloqués par le niveau. */
  slots: (string | null)[];
  /** Aura copiée par Mimique. */
  mimicOf: string | null;
  title: string | null;
  inventory: Record<string, InventoryEntry>;
  codex: Record<string, CodexEntry>;
  xp: number;
  talents: TalentRanks;
  prestige: { level: number; runStartRolls: number; history: PrestigeRecord[] };
  stats: PlayerStats;
  potions: {
    owned: Record<PotionId, number>;
    /** Timestamp de fin de chaque potion active. */
    active: Partial<Record<PotionId, number>>;
    /** Rareté visée par la potion de chance ciblée. */
    focusTarget: RarityId | null;
    /** Bénédictions garanties restantes. */
    pendingBlessings: number;
  };
  /** Malédiction en cours (Marque maudite) : bonus jusqu'à boonUntil, malus jusqu'à baneUntil. */
  curse: { boonUntil: number; baneUntil: number; luck: number; mul: number } | null;
  quests: { daily: QuestPeriod; weekly: QuestPeriod; missions: Record<string, number> };
  achievements: Record<string, number>;
  recent: RecentRoll[];
  /** Solde d'Éclats (monnaie), toujours calculé par le serveur. */
  shards: number;
  upgrades: UpgradeLevels;
  cosmetics: {
    /** Cosmétiques achetés → date d'achat. */
    owned: Partial<Record<CosmeticId, number>>;
    trail: CosmeticId | null;
    frame: CosmeticId | null;
  };
  /** Derniers mouvements d'Éclats (plus récent en premier). */
  ledger: LedgerEntry[];
  /** Indices révélés : succès secret → niveau (1 à 3). Les textes restent côté serveur. */
  hints: Record<string, number>;
  /** Dépôts en cours : id d'annonce, ou « trade:<id> ». */
  escrow: Record<string, EscrowEntry>;
  /** Achats au marché débités mais pas encore dénoués (id d'annonce → prix, aura). */
  purchases: Record<string, { price: number; auraId: string; at: number }>;
  /** Virements déjà reçus (produits de vente, auras d'échange) : jamais crédités deux fois. */
  processedTransfers: string[];
}

export const RECENT_LIMIT = 12;
/** Format accepté pour l'identifiant de requête envoyé par le client (UUID ou équivalent). */
export const REQUEST_ID_RE = /^[A-Za-z0-9-]{8,64}$/;
export const REQUEST_ID_LIMIT = 32;
export const PRESTIGE_HISTORY_LIMIT = 20;
export const STARTER_POTIONS: Partial<Record<PotionId, number>> = { luck: 2, speed: 1, blessing: 1 };

export function emptyPotionCounts(): Record<PotionId, number> {
  return Object.fromEntries(POTION_IDS.map((id) => [id, 0])) as Record<PotionId, number>;
}

export function createPlayerState(name: string, now: number): PlayerState {
  const owned = emptyPotionCounts();
  for (const [id, n] of Object.entries(STARTER_POTIONS)) owned[id as PotionId] = n ?? 0;
  return {
    version: 2,
    rev: 0,
    requestIds: [],
    name,
    createdAt: now,
    equipped: null,
    slots: [],
    mimicOf: null,
    title: null,
    inventory: {},
    codex: {},
    xp: 0,
    talents: emptyTalents(),
    prestige: { level: 0, runStartRolls: 0, history: [] },
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
      blessedRolls: 0,
      fusions: 0,
      questsClaimed: 0,
      shardsEarned: 0,
      shardsSpent: 0,
      marketDeals: 0,
      streakGuardEnd: 0,
    },
    potions: { owned, active: {}, focusTarget: null, pendingBlessings: 0 },
    curse: null,
    quests: { daily: emptyPeriod(""), weekly: emptyPeriod(""), missions: {} },
    achievements: {},
    recent: [],
    shards: 0,
    upgrades: emptyUpgrades(),
    cosmetics: { owned: {}, trail: null, frame: null },
    ledger: [],
    hints: {},
    escrow: {},
    purchases: {},
    processedTransfers: [],
  };
}

const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const int = (v: unknown, d = 0): number => Math.max(0, Math.floor(num(v, d)));
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : Object.values(obj(v)));

function normalizeEscrow(raw: unknown): Record<string, EscrowEntry> {
  const out: Record<string, EscrowEntry> = {};
  for (const [key, v] of Object.entries(obj(raw))) {
    const e = obj(v);
    if (key.length > 80 || (e.kind !== "listing" && e.kind !== "trade")) continue;
    const auras = list(e.auras)
      .map((x) => obj(x))
      .filter((x) => typeof x.auraId === "string" && getAura(x.auraId as string))
      .map((x) => ({ auraId: x.auraId as string, traded: x.traded === true }));
    if (auras.length) out[key] = { kind: e.kind, auras, at: num(e.at), price: int(e.price), version: int(e.version) };
  }
  return out;
}

function normalizePurchases(raw: unknown): PlayerState["purchases"] {
  const out: PlayerState["purchases"] = {};
  for (const [key, v] of Object.entries(obj(raw))) {
    const p = obj(v);
    if (key.length <= 80 && typeof p.auraId === "string" && getAura(p.auraId)) out[key] = { price: int(p.price), auraId: p.auraId, at: num(p.at) };
  }
  return out;
}

function normalizePeriod(raw: unknown): QuestPeriod {
  const r = obj(raw);
  const counters: Partial<Record<QuestCounter, number>> = {};
  for (const [k, v] of Object.entries(obj(r.counters))) counters[k as QuestCounter] = int(v);
  const claimed: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj(r.claimed))) claimed[k] = num(v);
  return { key: typeof r.key === "string" ? r.key : "", counters, claimed };
}

/**
 * Reconstruit un état complet et valide à partir de données brutes
 * (anciennes sauvegardes sans les nouveaux champs, objets vides supprimés, tableaux…).
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
    const count = int(entry.count);
    if (count > 0) {
      const traded = Math.min(count, int(entry.traded));
      inventory[id] = { count, firstAt: num(entry.firstAt), lastAt: num(entry.lastAt), firstRoll: int(entry.firstRoll), ...(traded ? { traded } : {}) };
    }
  }

  // Codex : les anciennes sauvegardes n'en ont pas, il se déduit alors de l'inventaire.
  const codex: Record<string, CodexEntry> = {};
  for (const [id, e] of Object.entries(obj(r.codex))) {
    if (!getAura(id)) continue;
    const entry = obj(e);
    codex[id] = { firstAt: num(entry.firstAt), total: int(entry.total) };
  }
  // Les exemplaires obtenus par échange ne comptent pas au codex.
  for (const [id, e] of Object.entries(inventory)) {
    const own = e.count - (e.traded ?? 0);
    if (own <= 0) continue;
    const c = codex[id];
    if (!c) codex[id] = { firstAt: e.firstAt, total: own };
    else c.total = Math.max(c.total, own);
  }

  const s = obj(r.stats);
  const bestAuraId = typeof s.bestAuraId === "string" && codex[s.bestAuraId] ? s.bestAuraId : null;
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
    blessedRolls: int(s.blessedRolls),
    fusions: int(s.fusions),
    questsClaimed: int(s.questsClaimed),
    shardsEarned: int(s.shardsEarned),
    shardsSpent: int(s.shardsSpent),
    marketDeals: int(s.marketDeals),
    streakGuardEnd: num(s.streakGuardEnd),
  };

  const p = obj(r.potions);
  const ownedRaw = obj(p.owned);
  const activeRaw = obj(p.active);
  const owned = emptyPotionCounts();
  const active: Partial<Record<PotionId, number>> = {};
  for (const id of POTION_IDS) {
    owned[id] = int(ownedRaw[id]);
    const until = num(activeRaw[id]);
    if (until > 0) active[id] = until;
  }
  const focusTarget = isRarityId(p.focusTarget) ? p.focusTarget : null;

  const achievements: Record<string, number> = {};
  for (const [id, at] of Object.entries(obj(r.achievements))) achievements[id] = num(at);

  const recent: RecentRoll[] = list(r.recent)
    .map((x) => obj(x))
    .filter((x) => typeof x.auraId === "string" && getAura(x.auraId as string))
    .map((x) => ({ auraId: x.auraId as string, at: num(x.at), luck: num(x.luck, 1) }))
    .slice(0, RECENT_LIMIT);

  const equipped = typeof r.equipped === "string" && inventory[r.equipped] ? r.equipped : null;
  const seen = new Set<string>(equipped ? [equipped] : []);
  const slots = list(r.slots)
    .slice(0, 4)
    .map((x) => {
      if (typeof x !== "string" || !inventory[x] || seen.has(x)) return null;
      seen.add(x);
      return x;
    });
  const mimicOf = typeof r.mimicOf === "string" && inventory[r.mimicOf] && getAura(r.mimicOf)?.special?.kind !== "mimic" ? r.mimicOf : null;

  const talentsRaw = obj(r.talents);
  const talents = emptyTalents();
  for (const t of TALENTS) talents[t.id] = Math.min(t.maxRank, int(talentsRaw[t.id]));

  const pr = obj(r.prestige);
  const prestige = {
    level: Math.min(10, int(pr.level)),
    runStartRolls: Math.min(stats.rolls, int(pr.runStartRolls)),
    history: list(pr.history)
      .map((x) => obj(x))
      .map((x) => ({
        at: num(x.at),
        level: int(x.level),
        runRolls: int(x.runRolls),
        bestAuraId: typeof x.bestAuraId === "string" && getAura(x.bestAuraId) ? x.bestAuraId : null,
        collection: int(x.collection),
      }))
      .slice(-PRESTIGE_HISTORY_LIMIT),
  };

  const c = obj(r.curse);
  const curse =
    num(c.baneUntil) > 0
      ? { boonUntil: num(c.boonUntil), baneUntil: num(c.baneUntil), luck: num(c.luck), mul: Math.min(1, Math.max(0.1, num(c.mul, 1))) }
      : null;

  const upRaw = obj(r.upgrades);
  const upgrades = emptyUpgrades();
  for (const u of UPGRADES) upgrades[u.id] = Math.min(u.maxLevel, int(upRaw[u.id]));

  const cos = obj(r.cosmetics);
  const cosOwned: Partial<Record<CosmeticId, number>> = {};
  for (const c of COSMETICS) {
    const at = num(obj(cos.owned)[c.id]);
    if (at > 0) cosOwned[c.id] = at;
  }
  const wear = (v: unknown, kind: "trail" | "frame") => (isCosmeticId(v) && cosOwned[v] && getCosmetic(v).kind === kind ? v : null);

  const ledger: LedgerEntry[] = list(r.ledger)
    .map((x) => obj(x))
    .filter((x) => typeof x.reason === "string")
    .map((x) => ({ at: num(x.at), amount: Math.trunc(num(x.amount)), reason: String(x.reason).slice(0, 80), balance: int(x.balance) }))
    .slice(0, LEDGER_LIMIT);

  const q = obj(r.quests);
  const missions: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj(q.missions))) missions[k] = int(v);

  return {
    version: 2,
    rev: int(r.rev),
    requestIds: list(r.requestIds)
      .filter((x): x is string => typeof x === "string" && REQUEST_ID_RE.test(x))
      .slice(0, REQUEST_ID_LIMIT),
    name: typeof r.name === "string" && r.name ? r.name : fallbackName,
    createdAt: num(r.createdAt, now),
    equipped,
    slots,
    mimicOf,
    title: typeof r.title === "string" ? r.title : null,
    inventory,
    codex,
    xp: int(r.xp),
    talents,
    prestige,
    stats,
    potions: { owned, active, focusTarget, pendingBlessings: Math.min(5, int(p.pendingBlessings)) },
    curse,
    quests: { daily: normalizePeriod(q.daily), weekly: normalizePeriod(q.weekly), missions },
    achievements,
    recent,
    shards: Math.min(SHARD_CAP, int(r.shards)),
    upgrades,
    cosmetics: { owned: cosOwned, trail: wear(cos.trail, "trail"), frame: wear(cos.frame, "frame") },
    ledger,
    escrow: normalizeEscrow(r.escrow),
    purchases: normalizePurchases(r.purchases),
    processedTransfers: list(r.processedTransfers)
      .filter((x): x is string => typeof x === "string" && x.length <= 120)
      .slice(0, 200),
    hints: Object.fromEntries(
      Object.entries(obj(r.hints))
        .filter(([id]) => isSecretAchievement(id))
        .map(([id, v]) => [id, Math.min(HINT_LEVELS, int(v))] as const)
        .filter(([, v]) => v > 0),
    ),
  };
}

/** Nombre d'auras différentes découvertes un jour (codex, conservé au prestige). */
export function discoveredCount(state: PlayerState): number {
  return Object.keys(state.codex).length;
}

/** Nombre d'auras différentes possédées dans la partie en cours. */
export function ownedCount(state: PlayerState): number {
  return Object.keys(state.inventory).length;
}
