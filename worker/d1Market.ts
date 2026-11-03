/**
 * Tables du marché sur Cloudflare D1. Chaque transition est une mise à jour CONDITIONNELLE
 * (statut, version, échéance) : si deux requêtes se croisent, une seule obtient `changes = 1`.
 * Toutes les valeurs passent par des paramètres liés (jamais de texte client dans le SQL).
 */
import type { Transfer } from "../shared";
import type { ListingRow, MarketStore, TradeRow, TradeSide } from "../functions/src/market";
import type { D1Database } from "./d1";

interface ListingSql {
  id: string;
  seller_id: string;
  seller_name: string;
  aura_id: string;
  price: number;
  created_at: number;
  expires_at: number;
  status: ListingRow["status"];
  buyer_id: string | null;
}

interface TradeSql {
  id: string;
  initiator_id: string;
  initiator_name: string;
  receiver_id: string;
  receiver_name: string;
  initiator_auras: string;
  receiver_auras: string;
  initiator_confirmed: number;
  receiver_confirmed: number;
  status: TradeRow["status"];
  version: number;
  created_at: number;
  expires_at: number;
}

interface TransferSql {
  id: string;
  kind: Transfer["kind"];
  amount: number;
  auras: string;
  reason: string;
}

const listing = (r: ListingSql): ListingRow => ({
  id: r.id,
  sellerId: r.seller_id,
  sellerName: r.seller_name,
  auraId: r.aura_id,
  price: r.price,
  createdAt: r.created_at,
  expiresAt: r.expires_at,
  status: r.status,
  buyerId: r.buyer_id,
});

const parseList = (json: string): string[] => {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

const trade = (r: TradeSql): TradeRow => ({
  id: r.id,
  initiatorId: r.initiator_id,
  initiatorName: r.initiator_name,
  receiverId: r.receiver_id,
  receiverName: r.receiver_name,
  initiatorAuras: parseList(r.initiator_auras),
  receiverAuras: parseList(r.receiver_auras),
  initiatorConfirmed: r.initiator_confirmed === 1,
  receiverConfirmed: r.receiver_confirmed === 1,
  status: r.status,
  version: r.version,
  createdAt: r.created_at,
  expiresAt: r.expires_at,
});

const LISTING_COLS = "id, seller_id, seller_name, aura_id, price, created_at, expires_at, status, buyer_id";
const TRADE_COLS =
  "id, initiator_id, initiator_name, receiver_id, receiver_name, initiator_auras, receiver_auras, initiator_confirmed, receiver_confirmed, status, version, created_at, expires_at";

export function createD1Market(db: D1Database): MarketStore {
  const changed = async (sql: string, ...values: unknown[]) => (await db.prepare(sql).bind(...values).run()).meta.changes === 1;

  return {
    async insertListing(r) {
      await db
        .prepare(`INSERT INTO market_listings (${LISTING_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(r.id, r.sellerId, r.sellerName, r.auraId, r.price, r.createdAt, r.expiresAt, r.status, r.buyerId)
        .run();
    },
    async getListing(id) {
      const r = await db.prepare(`SELECT ${LISTING_COLS} FROM market_listings WHERE id = ?`).bind(id).first<ListingSql>();
      return r ? listing(r) : null;
    },
    claimListing: (id, buyerId, now) =>
      changed("UPDATE market_listings SET status = 'sold', buyer_id = ?, sold_at = ? WHERE id = ? AND status = 'active' AND expires_at > ?", buyerId, now, id, now),
    closeListing: (id, status, now) =>
      status === "expired"
        ? changed("UPDATE market_listings SET status = 'expired' WHERE id = ? AND status = 'active' AND expires_at <= ?", id, now)
        : changed("UPDATE market_listings SET status = 'cancelled' WHERE id = ? AND status = 'active'", id),
    async activeListings(now, { auraId, limit }) {
      const { results } = auraId
        ? await db
            .prepare(`SELECT ${LISTING_COLS} FROM market_listings WHERE status = 'active' AND expires_at > ? AND aura_id = ? ORDER BY created_at DESC LIMIT ?`)
            .bind(now, auraId, limit)
            .all<ListingSql>()
        : await db
            .prepare(`SELECT ${LISTING_COLS} FROM market_listings WHERE status = 'active' AND expires_at > ? ORDER BY created_at DESC LIMIT ?`)
            .bind(now, limit)
            .all<ListingSql>();
      return results.map(listing);
    },
    async listingsBySeller(sellerId, limit) {
      const { results } = await db
        .prepare(`SELECT ${LISTING_COLS} FROM market_listings WHERE seller_id = ? ORDER BY created_at DESC LIMIT ?`)
        .bind(sellerId, limit)
        .all<ListingSql>();
      return results.map(listing);
    },
    async countActiveBySeller(sellerId, now) {
      const r = await db
        .prepare("SELECT COUNT(*) AS n FROM market_listings WHERE seller_id = ? AND status = 'active' AND expires_at > ?")
        .bind(sellerId, now)
        .first<{ n: number }>();
      return r?.n ?? 0;
    },

    async insertTrade(t) {
      await db
        .prepare(`INSERT INTO trades (${TRADE_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          t.id,
          t.initiatorId,
          t.initiatorName,
          t.receiverId,
          t.receiverName,
          JSON.stringify(t.initiatorAuras),
          JSON.stringify(t.receiverAuras),
          t.initiatorConfirmed ? 1 : 0,
          t.receiverConfirmed ? 1 : 0,
          t.status,
          t.version,
          t.createdAt,
          t.expiresAt,
        )
        .run();
    },
    async getTrade(id) {
      const r = await db.prepare(`SELECT ${TRADE_COLS} FROM trades WHERE id = ?`).bind(id).first<TradeSql>();
      return r ? trade(r) : null;
    },
    setTradeOffer: (id, side: TradeSide, auras, expectedVersion, now, expiresAt) =>
      changed(
        `UPDATE trades SET ${side === "initiator" ? "initiator_auras" : "receiver_auras"} = ?,
           initiator_confirmed = 0, receiver_confirmed = 0, version = version + 1, expires_at = ?
         WHERE id = ? AND status = 'pending' AND version = ? AND expires_at > ?`,
        JSON.stringify(auras),
        expiresAt,
        id,
        expectedVersion,
        now,
      ),
    confirmTrade: (id, side, version, now) =>
      changed(
        `UPDATE trades SET ${side === "initiator" ? "initiator_confirmed" : "receiver_confirmed"} = 1
         WHERE id = ? AND status = 'pending' AND version = ? AND expires_at > ?`,
        id,
        version,
        now,
      ),
    acceptTrade: (id, version, now) =>
      changed(
        `UPDATE trades SET status = 'accepted'
         WHERE id = ? AND status = 'pending' AND version = ? AND expires_at > ? AND initiator_confirmed = 1 AND receiver_confirmed = 1`,
        id,
        version,
        now,
      ),
    setTradeStatus: (id, to, now) =>
      to === "expired"
        ? changed("UPDATE trades SET status = 'expired' WHERE id = ? AND status = 'pending' AND expires_at <= ?", id, now)
        : changed(`UPDATE trades SET status = ? WHERE id = ? AND status = 'pending'`, to, id),
    async tradesFor(uid, limit) {
      const { results } = await db
        .prepare(`SELECT ${TRADE_COLS} FROM trades WHERE initiator_id = ? OR receiver_id = ? ORDER BY created_at DESC LIMIT ?`)
        .bind(uid, uid, limit)
        .all<TradeSql>();
      return results.map(trade);
    },
    async countPendingTrades(uid, now) {
      const r = await db
        .prepare("SELECT COUNT(*) AS n FROM trades WHERE (initiator_id = ? OR receiver_id = ?) AND status = 'pending' AND expires_at > ?")
        .bind(uid, uid, now)
        .first<{ n: number }>();
      return r?.n ?? 0;
    },

    async insertTransfer(toUid, t, now) {
      await db
        .prepare("INSERT OR IGNORE INTO transfers (id, to_uid, kind, amount, auras, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(t.id, toUid, t.kind, t.amount, JSON.stringify(t.auras), t.reason, now)
        .run();
    },
    async pendingTransfers(uid) {
      const { results } = await db
        .prepare("SELECT id, kind, amount, auras, reason FROM transfers WHERE to_uid = ? AND claimed_at IS NULL LIMIT 100")
        .bind(uid)
        .all<TransferSql>();
      return results.map((r) => ({ id: r.id, kind: r.kind, amount: r.amount, auras: parseList(r.auras), reason: r.reason }));
    },
    async markTransfers(uid, ids, now) {
      for (const id of ids) {
        await db.prepare("UPDATE transfers SET claimed_at = ? WHERE id = ? AND to_uid = ? AND claimed_at IS NULL").bind(now, id, uid).run();
      }
    },

    async recordFootprint(uid, ipHash, deviceHash, now) {
      await db
        .prepare(
          `INSERT INTO account_footprints (uid, ip_hash, device_hash, seen_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(uid, ip_hash, device_hash) DO UPDATE SET seen_at = excluded.seen_at`,
        )
        .bind(uid, ipHash, deviceHash, now)
        .run();
    },
    async sharedFootprint(a, b, since) {
      const r = await db
        .prepare(
          `SELECT 1 AS hit FROM account_footprints x JOIN account_footprints y
             ON (x.ip_hash = y.ip_hash AND x.ip_hash <> '') OR (x.device_hash = y.device_hash AND x.device_hash <> '')
           WHERE x.uid = ? AND y.uid = ? AND x.seen_at >= ? AND y.seen_at >= ? LIMIT 1`,
        )
        .bind(a, b, since, since)
        .first<{ hit: number }>();
      return r !== null;
    },
    async uidByName(lower) {
      const r = await db.prepare("SELECT uid FROM usernames WHERE name = ?").bind(lower).first<{ uid: string }>();
      if (r) return r.uid;
      // Comptes plus anciens sans pseudo réservé : on retrouve le joueur par son nom au classement.
      const lb = await db.prepare("SELECT uid FROM leaderboard WHERE lower(name) = ? LIMIT 1").bind(lower).first<{ uid: string }>();
      return lb?.uid ?? null;
    },
  };
}
