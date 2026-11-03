/**
 * Orchestration serveur du marché et des échanges directs.
 *
 * Une vente ou un échange touche DEUX joueurs : on ne peut pas tout écrire dans une seule ligne.
 * Le principe, sans jamais créer ni perdre d'aura ou d'Éclat :
 *  - chaque joueur n'est modifié que par une écriture atomique de SA ligne (dépôt, débit, réception) ;
 *  - une ligne d'annonce / d'échange sert de verrou : une mise à jour conditionnelle
 *    (« WHERE status = 'active' » / « AND version = ? ») ne réussit qu'une seule fois ;
 *  - ce qui revient à l'autre joueur passe par un « virement » (table transfers) qu'il encaisse
 *    lui-même, une seule fois (identifiant mémorisé dans son état) ;
 *  - `settle` dénoue tout ce qui est resté en suspens (annonce expirée, achat interrompu, échange
 *    annulé) : les auras en dépôt reviennent, les achats non aboutis sont remboursés.
 */
import {
  ANTI_MULE_WINDOW_MS,
  LISTING_DURATION_MS,
  MAX_ACTIVE_LISTINGS,
  MAX_PENDING_TRADES,
  MAX_TRADE_AURAS,
  STALE_PENDING_MS,
  TRADE_TIMEOUT_MS,
  completeEscrow,
  countAuras,
  escrowListing,
  escrowTrade,
  finishPurchase,
  getAura,
  receiveTransfer,
  refundPurchase,
  returnEscrow,
  sellerProceeds,
  startPurchase,
  tradableCount,
  tradeBlocker,
  USERNAME_RE,
  type ListingStatus,
  type ListingView,
  type PartnerInventoryView,
  type PlayerState,
  type TradeStatus,
  type TradeView,
  type Transfer,
} from "../../shared/index";
import { ApiError } from "./errors";

export interface ListingRow {
  id: string;
  sellerId: string;
  sellerName: string;
  auraId: string;
  price: number;
  createdAt: number;
  expiresAt: number;
  status: ListingStatus;
  buyerId: string | null;
}

export interface TradeRow {
  id: string;
  initiatorId: string;
  initiatorName: string;
  receiverId: string;
  receiverName: string;
  initiatorAuras: string[];
  receiverAuras: string[];
  initiatorConfirmed: boolean;
  receiverConfirmed: boolean;
  status: TradeStatus;
  version: number;
  createdAt: number;
  expiresAt: number;
}

export type TradeSide = "initiator" | "receiver";

/** Accès aux tables du marché (D1 en production, mémoire en local et dans les tests). */
export interface MarketStore {
  insertListing(row: ListingRow): Promise<void>;
  getListing(id: string): Promise<ListingRow | null>;
  /** active et non expirée → vendue à `buyerId`. Une seule réussite possible. */
  claimListing(id: string, buyerId: string, now: number): Promise<boolean>;
  /** active → cancelled (par le vendeur) ou expired (échue). */
  closeListing(id: string, status: "cancelled" | "expired", now: number): Promise<boolean>;
  activeListings(now: number, opts: { auraId?: string; limit: number }): Promise<ListingRow[]>;
  listingsBySeller(sellerId: string, limit: number): Promise<ListingRow[]>;
  countActiveBySeller(sellerId: string, now: number): Promise<number>;

  insertTrade(row: TradeRow): Promise<void>;
  getTrade(id: string): Promise<TradeRow | null>;
  /** Nouveau contenu d'un côté (si version attendue, pending et non expiré) : version+1, confirmations remises à zéro. */
  setTradeOffer(id: string, side: TradeSide, auras: string[], expectedVersion: number, now: number, expiresAt: number): Promise<boolean>;
  confirmTrade(id: string, side: TradeSide, version: number, now: number): Promise<boolean>;
  /** pending, version, deux confirmations, non expiré → accepted. */
  acceptTrade(id: string, version: number, now: number): Promise<boolean>;
  setTradeStatus(id: string, to: "cancelled" | "declined" | "expired", now: number): Promise<boolean>;
  tradesFor(uid: string, limit: number): Promise<TradeRow[]>;
  countPendingTrades(uid: string, now: number): Promise<number>;

  /** Virement vers un joueur (INSERT OR IGNORE : idempotent par identifiant). */
  insertTransfer(toUid: string, t: Transfer, now: number): Promise<void>;
  pendingTransfers(uid: string): Promise<Transfer[]>;
  markTransfers(uid: string, ids: string[], now: number): Promise<void>;

  /** Empreintes (hachées) IP / appareil, pour l'anti-mule. */
  recordFootprint(uid: string, ipHash: string, deviceHash: string, now: number): Promise<void>;
  sharedFootprint(a: string, b: string, since: number): Promise<boolean>;
  uidByName(lower: string): Promise<string | null>;
}

export interface MarketContext {
  uid: string;
  market: MarketStore;
  now: () => number;
  /** Écriture atomique de l'état du joueur courant. */
  run: (fn: (s: PlayerState, now: number) => PlayerState) => Promise<PlayerState>;
  /** Lecture (sans écriture) de l'état d'un joueur. */
  read: (uid: string) => Promise<PlayerState | null>;
  newId: () => string;
}

const fail = (message: string) => new ApiError("failed-precondition", message);
const LISTING_ID_RE = /^[A-Za-z0-9-]{8,64}$/;

export function isMarketId(v: unknown): v is string {
  return typeof v === "string" && LISTING_ID_RE.test(v);
}

/** Liste d'auras envoyée par le client : ids connus, 5 au maximum. */
export function parseAuraList(v: unknown): string[] {
  if (!Array.isArray(v) || v.length > MAX_TRADE_AURAS) throw new ApiError("invalid-argument", `Entre 0 et ${MAX_TRADE_AURAS} auras par côté`);
  for (const id of v) if (typeof id !== "string" || !getAura(id)) throw new ApiError("invalid-argument", "Aura inconnue");
  return v as string[];
}

async function antiMule(ctx: MarketContext, other: string) {
  if (await ctx.market.sharedFootprint(ctx.uid, other, ctx.now() - ANTI_MULE_WINDOW_MS)) {
    throw fail("Échange impossible : ces deux comptes ont utilisé le même réseau ou appareil dans les dernières 24 h");
  }
}

// ───────────── Dénouement (appelé au chargement, au heartbeat et avant chaque action de marché) ─────────────

export async function settle(ctx: MarketContext): Promise<void> {
  const { market, uid } = ctx;
  const s = await ctx.read(uid);
  const transfers = await market.pendingTransfers(uid);
  if (!s || (!Object.keys(s.escrow).length && !Object.keys(s.purchases).length && !transfers.length)) return;
  const now = ctx.now();

  const toReturn: string[] = [];
  const toComplete: string[] = [];
  for (const [key, e] of Object.entries(s.escrow)) {
    if (e.kind === "listing") {
      const l = await market.getListing(key);
      if (!l) {
        if (now - e.at > STALE_PENDING_MS) toReturn.push(key); // l'annonce n'a jamais été créée
      } else if (l.status === "sold") {
        // garantit le paiement du vendeur même si l'acheteur a été interrompu après le verrou
        await market.insertTransfer(uid, saleTransfer(l), now);
        toComplete.push(key);
      } else if (l.status === "cancelled" || l.status === "expired") {
        toReturn.push(key);
      } else if (l.expiresAt <= now) {
        await market.closeListing(key, "expired", now);
        const again = await market.getListing(key);
        if (again?.status === "sold") toComplete.push(key);
        else toReturn.push(key);
      }
    } else {
      const t = await market.getTrade(key.slice("trade:".length));
      if (!t) {
        if (now - e.at > STALE_PENDING_MS) toReturn.push(key);
      } else if (t.status === "accepted" && t.version === e.version) {
        toComplete.push(key);
      } else if (t.status === "pending" && t.version === e.version && t.expiresAt > now) {
        // en attente de l'autre joueur : on garde le dépôt
      } else {
        if (t.status === "pending" && t.expiresAt <= now) await market.setTradeStatus(t.id, "expired", now);
        const again = await market.getTrade(t.id);
        if (again?.status === "accepted" && again.version === e.version) toComplete.push(key);
        else toReturn.push(key);
      }
    }
  }

  const toFinish: string[] = [];
  const toRefund: string[] = [];
  for (const [id, p] of Object.entries(s.purchases)) {
    const l = await market.getListing(id);
    if (l && l.status === "sold" && l.buyerId === uid) {
      await market.insertTransfer(l.sellerId, saleTransfer(l), now);
      toFinish.push(id);
    } else if (!l || l.status !== "active" || now - p.at > STALE_PENDING_MS) {
      toRefund.push(id);
    }
  }

  if (!toReturn.length && !toComplete.length && !toFinish.length && !toRefund.length && !transfers.length) return;
  await ctx.run((state, t) => {
    // Tout est idempotent : une entrée déjà traitée (requête concurrente) est simplement ignorée.
    for (const k of toReturn) returnEscrow(state, k, t);
    for (const k of toComplete) completeEscrow(state, k);
    for (const id of toFinish) finishPurchase(state, id, t);
    for (const id of toRefund) refundPurchase(state, id, t);
    for (const tr of transfers) receiveTransfer(state, tr, t);
    return state;
  });
  if (transfers.length) await market.markTransfers(uid, transfers.map((t) => t.id), now);
}

function saleTransfer(l: ListingRow): Transfer {
  return {
    id: `sale:${l.id}`,
    kind: "shards",
    amount: sellerProceeds(l.price),
    auras: [],
    reason: `Vente au marché : ${getAura(l.auraId)?.name ?? l.auraId} (taxe 5 % déduite)`,
  };
}

// ───────────── Marché ─────────────

export function listingView(l: ListingRow, viewer: string, now: number): ListingView {
  const status: ListingStatus = l.status === "active" && l.expiresAt <= now ? "expired" : l.status;
  return { id: l.id, sellerName: l.sellerName, auraId: l.auraId, price: l.price, createdAt: l.createdAt, expiresAt: l.expiresAt, status, mine: l.sellerId === viewer };
}

export async function browseMarket(ctx: MarketContext, auraId: unknown): Promise<{ listings: ListingView[]; mine: ListingView[] }> {
  if (auraId !== undefined && auraId !== null && (typeof auraId !== "string" || !getAura(auraId))) throw new ApiError("invalid-argument", "Aura inconnue");
  const now = ctx.now();
  const listings = await ctx.market.activeListings(now, { auraId: (auraId as string | undefined) ?? undefined, limit: 100 });
  const mine = await ctx.market.listingsBySeller(ctx.uid, 40);
  return { listings: listings.map((l) => listingView(l, ctx.uid, now)), mine: mine.map((l) => listingView(l, ctx.uid, now)) };
}

export async function createListing(ctx: MarketContext, auraId: unknown, price: unknown): Promise<PlayerState> {
  if (typeof auraId !== "string" || !getAura(auraId)) throw new ApiError("invalid-argument", "Aura inconnue");
  if (typeof price !== "number" || !Number.isSafeInteger(price)) throw new ApiError("invalid-argument", "Prix invalide");
  if ((await ctx.market.countActiveBySeller(ctx.uid, ctx.now())) >= MAX_ACTIVE_LISTINGS) {
    throw fail(`${MAX_ACTIVE_LISTINGS} annonces actives au maximum`);
  }
  const id = ctx.newId();
  let createdAt = 0;
  const state = await ctx.run((s, now) => {
    escrowListing(s, id, auraId, price, now);
    createdAt = now;
    return s;
  });
  try {
    await ctx.market.insertListing({
      id,
      sellerId: ctx.uid,
      sellerName: state.name,
      auraId,
      price,
      createdAt,
      expiresAt: createdAt + LISTING_DURATION_MS,
      status: "active",
      buyerId: null,
    });
  } catch (e) {
    await ctx.run((s, now) => (returnEscrow(s, id, now), s));
    throw e;
  }
  return state;
}

export async function cancelListing(ctx: MarketContext, id: unknown): Promise<void> {
  if (!isMarketId(id)) throw new ApiError("invalid-argument", "Annonce invalide");
  const l = await ctx.market.getListing(id);
  if (!l || l.sellerId !== ctx.uid) throw fail("Annonce introuvable");
  if (!(await ctx.market.closeListing(id, "cancelled", ctx.now()))) throw fail("Annonce déjà vendue ou expirée");
  await settle(ctx);
}

export async function buyListing(ctx: MarketContext, id: unknown): Promise<PlayerState> {
  if (!isMarketId(id)) throw new ApiError("invalid-argument", "Annonce invalide");
  const { market } = ctx;
  const l = await market.getListing(id);
  const now = ctx.now();
  if (!l || l.status !== "active" || l.expiresAt <= now) throw fail("Annonce déjà vendue ou expirée");
  if (l.sellerId === ctx.uid) throw fail("Tu ne peux pas acheter ta propre annonce");
  await antiMule(ctx, l.sellerId);

  // 1) débit de l'acheteur (atomique, sur sa ligne)
  await ctx.run((s, t) => (startPurchase(s, l.id, l.price, l.auraId, t), s));
  // 2) verrou : une seule requête au monde peut passer l'annonce en « vendue »
  const claimed = await market.claimListing(l.id, ctx.uid, ctx.now());
  if (!claimed) {
    await ctx.run((s, t) => (refundPurchase(s, l.id, t), s));
    throw fail("Annonce déjà vendue ou expirée (remboursé)");
  }
  // 3) le vendeur sera payé (moins la taxe) à sa prochaine visite ; l'acheteur reçoit l'aura
  await market.insertTransfer(l.sellerId, saleTransfer(l), ctx.now());
  return ctx.run((s, t) => (finishPurchase(s, l.id, t), s));
}

// ───────────── Échanges directs ─────────────

export function tradeView(t: TradeRow, viewer: string, now: number): TradeView {
  const role: TradeSide = t.initiatorId === viewer ? "initiator" : "receiver";
  const mine = role === "initiator";
  const status: TradeStatus = t.status === "pending" && t.expiresAt <= now ? "expired" : t.status;
  return {
    id: t.id,
    role,
    partnerName: mine ? t.receiverName : t.initiatorName,
    myAuras: mine ? t.initiatorAuras : t.receiverAuras,
    theirAuras: mine ? t.receiverAuras : t.initiatorAuras,
    myConfirmed: mine ? t.initiatorConfirmed : t.receiverConfirmed,
    theirConfirmed: mine ? t.receiverConfirmed : t.initiatorConfirmed,
    status,
    version: t.version,
    expiresAt: t.expiresAt,
  };
}

function sideOf(t: TradeRow, uid: string): TradeSide {
  if (t.initiatorId === uid) return "initiator";
  if (t.receiverId === uid) return "receiver";
  throw fail("Échange introuvable");
}

/** Vérifie (sans rien écrire) que le joueur possède bien ces auras et peut les échanger. */
function checkOwnership(s: PlayerState, auras: string[], now: number) {
  for (const [id, n] of countAuras(auras)) {
    const blocker = tradeBlocker(s, id, n, now);
    if (blocker) throw fail(`${getAura(id)!.name} : ${blocker}`);
  }
}

async function loadTrade(ctx: MarketContext, id: unknown): Promise<TradeRow> {
  if (!isMarketId(id)) throw new ApiError("invalid-argument", "Échange invalide");
  const t = await ctx.market.getTrade(id);
  if (!t) throw fail("Échange introuvable");
  sideOf(t, ctx.uid);
  return t;
}

export async function listTrades(ctx: MarketContext): Promise<TradeView[]> {
  const now = ctx.now();
  return (await ctx.market.tradesFor(ctx.uid, 20)).map((t) => tradeView(t, ctx.uid, now));
}

export async function createTrade(ctx: MarketContext, receiverName: unknown, offer: unknown): Promise<string> {
  if (typeof receiverName !== "string" || !USERNAME_RE.test(receiverName)) throw new ApiError("invalid-argument", "Pseudo invalide");
  const auras = parseAuraList(offer);
  const receiverId = await ctx.market.uidByName(receiverName.toLowerCase());
  if (!receiverId) throw fail("Aucun joueur avec ce pseudo");
  if (receiverId === ctx.uid) throw fail("Tu ne peux pas échanger avec toi-même");
  await antiMule(ctx, receiverId);
  const now = ctx.now();
  if ((await ctx.market.countPendingTrades(ctx.uid, now)) >= MAX_PENDING_TRADES) throw fail(`${MAX_PENDING_TRADES} échanges en cours au maximum`);
  const me = await ctx.read(ctx.uid);
  const them = await ctx.read(receiverId);
  if (!me || !them) throw fail("Joueur introuvable");
  checkOwnership(me, auras, now);
  const id = ctx.newId();
  await ctx.market.insertTrade({
    id,
    initiatorId: ctx.uid,
    initiatorName: me.name,
    receiverId,
    receiverName: them.name,
    initiatorAuras: auras,
    receiverAuras: [],
    initiatorConfirmed: false,
    receiverConfirmed: false,
    status: "pending",
    version: 1,
    createdAt: now,
    expiresAt: now + TRADE_TIMEOUT_MS,
  });
  return id;
}

/** Change sa propre offre : les deux confirmations repartent de zéro, le délai de 3 min aussi. */
export async function updateTradeOffer(ctx: MarketContext, id: unknown, offer: unknown): Promise<void> {
  const t = await loadTrade(ctx, id);
  const auras = parseAuraList(offer);
  const now = ctx.now();
  if (t.status !== "pending" || t.expiresAt <= now) throw fail("Échange terminé ou expiré");
  const me = await ctx.read(ctx.uid);
  if (!me) throw fail("Joueur introuvable");
  checkOwnership(me, auras, now);
  if (!(await ctx.market.setTradeOffer(t.id, sideOf(t, ctx.uid), auras, t.version, now, now + TRADE_TIMEOUT_MS))) {
    throw fail("L'échange vient de changer : vérifie la nouvelle offre");
  }
  await settle(ctx); // rend un éventuel dépôt d'une version précédente
}

/**
 * Confirme la version affichée. Les auras de ce joueur passent en dépôt ; quand les deux côtés
 * ont confirmé LA MÊME version, l'échange est conclu et chacun reçoit les auras de l'autre.
 */
export async function confirmTrade(ctx: MarketContext, id: unknown, version: unknown): Promise<void> {
  const t = await loadTrade(ctx, id);
  if (typeof version !== "number" || version !== t.version) throw fail("L'échange a changé : vérifie la nouvelle offre avant de confirmer");
  const now = ctx.now();
  if (t.status !== "pending" || t.expiresAt <= now) throw fail("Échange terminé ou expiré");
  if (!t.initiatorAuras.length && !t.receiverAuras.length) throw fail("Échange vide");
  const side = sideOf(t, ctx.uid);
  const other = side === "initiator" ? t.receiverId : t.initiatorId;
  await antiMule(ctx, other);
  const mine = side === "initiator" ? t.initiatorAuras : t.receiverAuras;

  await ctx.run((s, n) => (escrowTrade(s, t.id, t.version, mine, n), s));
  if (!(await ctx.market.confirmTrade(t.id, side, t.version, ctx.now()))) {
    await settle(ctx); // version dépassée ou expiré : le dépôt revient
    throw fail("L'échange a changé ou expiré : rien n'a été échangé");
  }
  if (await ctx.market.acceptTrade(t.id, t.version, ctx.now())) {
    const at = ctx.now();
    await ctx.market.insertTransfer(t.initiatorId, { id: `trade:${t.id}:in`, kind: "auras", amount: 0, auras: t.receiverAuras, reason: `Échange avec ${t.receiverName}` }, at);
    await ctx.market.insertTransfer(t.receiverId, { id: `trade:${t.id}:re`, kind: "auras", amount: 0, auras: t.initiatorAuras, reason: `Échange avec ${t.initiatorName}` }, at);
  }
  await settle(ctx);
}

export async function cancelTrade(ctx: MarketContext, id: unknown): Promise<void> {
  const t = await loadTrade(ctx, id);
  if (t.status !== "pending") throw fail("Échange déjà terminé");
  const to = sideOf(t, ctx.uid) === "receiver" ? "declined" : "cancelled";
  await ctx.market.setTradeStatus(t.id, to, ctx.now());
  await settle(ctx);
}

/** Inventaire échangeable du partenaire (uniquement pour un participant de l'échange). */
export async function partnerInventory(ctx: MarketContext, id: unknown): Promise<PartnerInventoryView> {
  const t = await loadTrade(ctx, id);
  const otherId = sideOf(t, ctx.uid) === "initiator" ? t.receiverId : t.initiatorId;
  const other = await ctx.read(otherId);
  if (!other) throw fail("Joueur introuvable");
  const now = ctx.now();
  const auras: Record<string, number> = {};
  for (const auraId of Object.keys(other.inventory)) {
    const n = tradableCount(other, auraId, now);
    if (n > 0) auras[auraId] = n;
  }
  return { name: other.name, auras };
}
