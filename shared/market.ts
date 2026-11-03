/**
 * Marché (vente contre Éclats) et échanges directs : règles et transitions d'état d'UN joueur.
 * Les opérations entre deux joueurs sont orchestrées par le serveur (functions/src/market.ts) ;
 * ici, uniquement des fonctions pures, testables et identiques partout.
 *
 * Dépôt : une aura mise en vente ou proposée dans un échange confirmé quitte l'inventaire
 * et passe dans `state.escrow`. Elle revient si la vente/l'échange n'aboutit pas.
 */
import { getAura, isRollable } from "./auras";
import { SHARD_CAP } from "./economy";
import { GameError } from "./engine";
import type { RarityId } from "./rarities";
import type { EscrowEntry, PlayerState } from "./state";

export const LISTING_FEE_RATE = 0.01;
export const LISTING_FEE_MIN = 10;
/** Taxe prélevée sur le prix de vente (les Éclats disparaissent : anti-inflation). */
export const SALE_TAX_RATE = 0.05;
export const LISTING_DURATION_MS = 48 * 3_600_000;
export const MAX_ACTIVE_LISTINGS = 20;
export const MARKET_MAX_PRICE = SHARD_CAP;

export const TRADE_TIMEOUT_MS = 3 * 60_000;
export const MAX_TRADE_AURAS = 5;
export const MAX_PENDING_TRADES = 3;

/** Deux comptes vus sur la même IP ou le même appareil dans cette fenêtre ne peuvent pas commercer. */
export const ANTI_MULE_WINDOW_MS = 24 * 3_600_000;

/** Après ce délai, un dépôt ou un achat sans suite est considéré comme abandonné (remboursé / rendu). */
export const STALE_PENDING_MS = 60_000;

/** Prix plancher par rareté (anti-transfert entre comptes). */
export const MARKET_FLOORS: Record<RarityId, number> = {
  common: 1,
  uncommon: 5,
  rare: 25,
  epic: 150,
  legendary: 1_000,
  mythical: 8_000,
  corrupted: 40_000,
  divine: 80_000,
  celestial: 800_000,
  primordial: 4_000_000,
  transcendent: 8_000_000,
  dream: 16_000_000,
  infinity: 80_000_000,
  void: 400_000_000,
  beyond: 800_000_000,
};

export const listingFee = (price: number) => Math.max(LISTING_FEE_MIN, Math.floor(price * LISTING_FEE_RATE));
export const saleTax = (price: number) => Math.floor(price * SALE_TAX_RATE);
export const sellerProceeds = (price: number) => price - saleTax(price);

export function floorPrice(auraId: string): number {
  const a = getAura(auraId);
  return a ? MARKET_FLOORS[a.rarity] : Infinity;
}

/** Une aura est-elle équipée quelque part (principale, emplacements, copiée par Mimique) ? */
function isWorn(state: PlayerState, auraId: string): boolean {
  return state.equipped === auraId || state.slots.includes(auraId) || state.mimicOf === auraId;
}

/**
 * Raison pour laquelle une aura ne peut pas quitter l'inventaire (null = possible).
 * `quantity` exemplaires doivent rester disponibles en plus de celui qui est porté.
 */
export function tradeBlocker(state: PlayerState, auraId: string, quantity: number, now: number): string | null {
  const aura = getAura(auraId);
  if (!aura) return "Aura inconnue";
  if (aura.special?.kind === "fusion") return "Les auras de fusion ne s'échangent pas";
  if (aura.special?.kind === "seasonal" && !isRollable(aura, now)) return "Aura saisonnière hors de sa saison";
  const owned = state.inventory[auraId]?.count ?? 0;
  const reserved = isWorn(state, auraId) ? 1 : 0;
  if (owned - reserved < quantity) return reserved && owned >= quantity ? "Aura équipée : déséquipe-la d'abord" : "Exemplaires insuffisants";
  return null;
}

/** Exemplaires échangeables d'une aura (hors exemplaire porté). */
export function tradableCount(state: PlayerState, auraId: string, now: number): number {
  const owned = state.inventory[auraId]?.count ?? 0;
  if (owned === 0 || tradeBlocker(state, auraId, 1, now)) return 0;
  return owned - (isWorn(state, auraId) ? 1 : 0);
}

/** Compte les auras d'une liste (["phenix","phenix","abysse"] → {phenix: 2, abysse: 1}). */
export function countAuras(ids: readonly string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1);
  return m;
}

/**
 * Retire des exemplaires de l'inventaire vers un dépôt. Les exemplaires « obtenus par échange »
 * partent en premier (ils ne repassent jamais pour des exemplaires obtenus en roll).
 */
function takeFromInventory(state: PlayerState, auraIds: readonly string[], now: number): EscrowEntry["auras"] {
  for (const [id, n] of countAuras(auraIds)) {
    const blocker = tradeBlocker(state, id, n, now);
    if (blocker) throw new GameError("invalid", `${getAura(id)?.name ?? id} : ${blocker}`);
  }
  const out: EscrowEntry["auras"] = [];
  for (const id of auraIds) {
    const entry = state.inventory[id]!;
    const traded = (entry.traded ?? 0) > 0;
    if (traded) entry.traded = (entry.traded ?? 0) - 1;
    entry.count -= 1;
    if (entry.count <= 0) delete state.inventory[id];
    out.push({ auraId: id, traded });
  }
  return out;
}

/** Rend les auras d'un dépôt à l'inventaire (même provenance qu'avant). */
function giveBack(state: PlayerState, auras: EscrowEntry["auras"], now: number) {
  for (const { auraId, traded } of auras) addAura(state, auraId, traded, now);
}

/** Ajoute un exemplaire ; `traded` = obtenu par échange (badge, ne compte ni au codex ni au record). */
export function addAura(state: PlayerState, auraId: string, traded: boolean, now: number) {
  if (!getAura(auraId)) return;
  const entry = state.inventory[auraId];
  if (entry) {
    entry.count += 1;
    entry.lastAt = now;
    if (traded) entry.traded = (entry.traded ?? 0) + 1;
  } else {
    state.inventory[auraId] = { count: 1, firstAt: now, lastAt: now, firstRoll: state.stats.rolls, traded: traded ? 1 : 0 };
  }
}

function debit(state: PlayerState, amount: number, reason: string, now: number) {
  if (state.shards < amount) throw new GameError("funds", `Il te manque ${(amount - state.shards).toLocaleString("fr-FR")} éclats`);
  state.shards -= amount;
  state.stats.shardsSpent += amount;
  state.ledger.unshift({ at: now, amount: -amount, reason, balance: state.shards });
  state.ledger = state.ledger.slice(0, 40);
}

function credit(state: PlayerState, amount: number, reason: string, now: number) {
  const credited = Math.max(0, Math.min(amount, SHARD_CAP - state.shards));
  state.shards += credited;
  state.stats.shardsEarned += credited;
  state.ledger.unshift({ at: now, amount: credited, reason, balance: state.shards });
  state.ledger = state.ledger.slice(0, 40);
}

// ───────────── Transitions d'état (un seul joueur, appliquées dans une écriture atomique) ─────────────

/** Mise en vente : vérifie prix et aura, débite les frais, met l'exemplaire en dépôt. */
export function escrowListing(state: PlayerState, listingId: string, auraId: string, price: number, now: number) {
  if (!Number.isSafeInteger(price) || price < 1) throw new GameError("invalid", "Prix invalide");
  const floor = floorPrice(auraId);
  if (price < floor) throw new GameError("invalid", `Prix minimum pour cette rareté : ${floor.toLocaleString("fr-FR")} éclats`);
  if (price > MARKET_MAX_PRICE) throw new GameError("invalid", "Prix trop élevé");
  if (state.escrow[listingId]) throw new GameError("invalid", "Annonce déjà créée");
  const fee = listingFee(price);
  if (state.shards < fee) throw new GameError("funds", `Frais de mise en vente : ${fee.toLocaleString("fr-FR")} éclats`);
  const auras = takeFromInventory(state, [auraId], now);
  debit(state, fee, `Frais de mise en vente : ${getAura(auraId)!.name}`, now);
  state.escrow[listingId] = { kind: "listing", auras, at: now, price, version: 0 };
}

/** Dépôt d'un échange confirmé (version = version de l'échange au moment de la confirmation). */
export function escrowTrade(state: PlayerState, tradeId: string, version: number, auraIds: readonly string[], now: number) {
  const key = `trade:${tradeId}`;
  const current = state.escrow[key];
  if (current) {
    if (current.version === version) return; // déjà en dépôt pour cette version
    giveBack(state, current.auras, now);
    delete state.escrow[key];
  }
  state.escrow[key] = { kind: "trade", auras: takeFromInventory(state, auraIds, now), at: now, price: 0, version };
}

/** Le dépôt n'a pas abouti (annulé, expiré, version dépassée) : les auras reviennent. */
export function returnEscrow(state: PlayerState, key: string, now: number): boolean {
  const e = state.escrow[key];
  if (!e) return false;
  giveBack(state, e.auras, now);
  delete state.escrow[key];
  return true;
}

/** Le dépôt a abouti (vendu, échangé) : les auras sont parties définitivement. */
export function completeEscrow(state: PlayerState, key: string): boolean {
  if (!state.escrow[key]) return false;
  delete state.escrow[key];
  state.stats.marketDeals += 1;
  return true;
}

/** Achat, étape 1 : débite l'acheteur et note l'achat en attente (idempotent par annonce). */
export function startPurchase(state: PlayerState, listingId: string, price: number, auraId: string, now: number) {
  if (state.purchases[listingId]) throw new GameError("invalid", "Achat déjà en cours");
  debit(state, price, `Achat au marché : ${getAura(auraId)?.name ?? auraId}`, now);
  state.purchases[listingId] = { price, auraId, at: now };
}

/** Achat, étape 2 : l'annonce est bien à nous, l'aura arrive (marquée « obtenue par échange »). */
export function finishPurchase(state: PlayerState, listingId: string, now: number): boolean {
  const p = state.purchases[listingId];
  if (!p) return false;
  addAura(state, p.auraId, true, now);
  delete state.purchases[listingId];
  state.stats.marketDeals += 1;
  return true;
}

/** Achat raté (annonce déjà vendue, expirée…) : remboursement intégral. */
export function refundPurchase(state: PlayerState, listingId: string, now: number): boolean {
  const p = state.purchases[listingId];
  if (!p) return false;
  credit(state, p.price, `Remboursement : ${getAura(p.auraId)?.name ?? "achat"}`, now);
  delete state.purchases[listingId];
  return true;
}

export interface Transfer {
  id: string;
  kind: "shards" | "auras";
  amount: number;
  auras: string[];
  reason: string;
}

/** Réception d'un virement (produit d'une vente, auras d'un échange) — une seule fois par identifiant. */
export function receiveTransfer(state: PlayerState, t: Transfer, now: number): boolean {
  if (state.processedTransfers.includes(t.id)) return false;
  if (t.kind === "shards") credit(state, t.amount, t.reason, now);
  else for (const id of t.auras) addAura(state, id, true, now);
  state.processedTransfers = [t.id, ...state.processedTransfers].slice(0, 200);
  return true;
}

// ───────────── Vues renvoyées au client (aucun uid) ─────────────

export type ListingStatus = "active" | "sold" | "expired" | "cancelled";
export type TradeStatus = "pending" | "accepted" | "declined" | "cancelled" | "expired";

export interface ListingView {
  id: string;
  sellerName: string;
  auraId: string;
  price: number;
  createdAt: number;
  expiresAt: number;
  status: ListingStatus;
  mine: boolean;
}

export interface TradeView {
  id: string;
  /** Rôle du joueur qui consulte. */
  role: "initiator" | "receiver";
  partnerName: string;
  myAuras: string[];
  theirAuras: string[];
  myConfirmed: boolean;
  theirConfirmed: boolean;
  status: TradeStatus;
  version: number;
  expiresAt: number;
}

export interface PartnerInventoryView {
  name: string;
  /** Auras échangeables du partenaire : id → exemplaires disponibles. */
  auras: Record<string, number>;
}
