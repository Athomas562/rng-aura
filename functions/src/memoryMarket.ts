/**
 * Tables du marché en mémoire : mode hors ligne (`npm run dev:offline`) et tests.
 * Même contrat que la version D1 : chaque méthode conditionnelle ne réussit qu'une fois.
 * Une pause aléatoire facultative entrelace les requêtes concurrentes dans les tests.
 */
import type { Transfer } from "../../shared/index";
import type { ListingRow, MarketStore, TradeRow, TradeSide } from "./market";

interface StoredTransfer extends Transfer {
  to: string;
  claimedAt: number | null;
}

export interface MemoryMarketData {
  listings: Record<string, ListingRow>;
  trades: Record<string, TradeRow>;
  transfers: Record<string, StoredTransfer>;
  footprints: { uid: string; ip: string; device: string; seenAt: number }[];
  names: Record<string, string>;
}

export function emptyMarketData(): MemoryMarketData {
  return { listings: {}, trades: {}, transfers: {}, footprints: [], names: {} };
}

export function createMemoryMarket(data: MemoryMarketData = emptyMarketData(), opts: { jitterMs?: number; onChange?: () => void } = {}): MarketStore & { data: MemoryMarketData } {
  const pause = () => (opts.jitterMs ? new Promise((r) => setTimeout(r, Math.random() * opts.jitterMs!)) : Promise.resolve());
  const changed = () => opts.onChange?.();
  const clone = <T>(v: T): T => structuredClone(v);

  return {
    data,

    async insertListing(row) {
      await pause();
      if (data.listings[row.id]) throw new Error("annonce déjà existante");
      data.listings[row.id] = clone(row);
      changed();
    },
    async getListing(id) {
      await pause();
      return data.listings[id] ? clone(data.listings[id]) : null;
    },
    async claimListing(id, buyerId, now) {
      await pause();
      const l = data.listings[id];
      if (!l || l.status !== "active" || l.expiresAt <= now) return false;
      l.status = "sold";
      l.buyerId = buyerId;
      changed();
      return true;
    },
    async closeListing(id, status, now) {
      await pause();
      const l = data.listings[id];
      if (!l || l.status !== "active") return false;
      if (status === "expired" && l.expiresAt > now) return false;
      l.status = status;
      changed();
      return true;
    },
    async activeListings(now, { auraId, limit }) {
      await pause();
      return Object.values(data.listings)
        .filter((l) => l.status === "active" && l.expiresAt > now && (!auraId || l.auraId === auraId))
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit)
        .map(clone);
    },
    async listingsBySeller(sellerId, limit) {
      await pause();
      return Object.values(data.listings)
        .filter((l) => l.sellerId === sellerId)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit)
        .map(clone);
    },
    async countActiveBySeller(sellerId, now) {
      await pause();
      return Object.values(data.listings).filter((l) => l.sellerId === sellerId && l.status === "active" && l.expiresAt > now).length;
    },

    async insertTrade(row) {
      await pause();
      data.trades[row.id] = clone(row);
      changed();
    },
    async getTrade(id) {
      await pause();
      return data.trades[id] ? clone(data.trades[id]) : null;
    },
    async setTradeOffer(id, side: TradeSide, auras, expectedVersion, now, expiresAt) {
      await pause();
      const t = data.trades[id];
      if (!t || t.status !== "pending" || t.version !== expectedVersion || t.expiresAt <= now) return false;
      if (side === "initiator") t.initiatorAuras = [...auras];
      else t.receiverAuras = [...auras];
      t.initiatorConfirmed = false;
      t.receiverConfirmed = false;
      t.version += 1;
      t.expiresAt = expiresAt;
      changed();
      return true;
    },
    async confirmTrade(id, side, version, now) {
      await pause();
      const t = data.trades[id];
      if (!t || t.status !== "pending" || t.version !== version || t.expiresAt <= now) return false;
      if (side === "initiator") t.initiatorConfirmed = true;
      else t.receiverConfirmed = true;
      changed();
      return true;
    },
    async acceptTrade(id, version, now) {
      await pause();
      const t = data.trades[id];
      if (!t || t.status !== "pending" || t.version !== version || t.expiresAt <= now || !t.initiatorConfirmed || !t.receiverConfirmed) return false;
      t.status = "accepted";
      changed();
      return true;
    },
    async setTradeStatus(id, to, now) {
      await pause();
      const t = data.trades[id];
      if (!t || t.status !== "pending") return false;
      if (to === "expired" && t.expiresAt > now) return false;
      t.status = to;
      changed();
      return true;
    },
    async tradesFor(uid, limit) {
      await pause();
      return Object.values(data.trades)
        .filter((t) => t.initiatorId === uid || t.receiverId === uid)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit)
        .map(clone);
    },
    async countPendingTrades(uid, now) {
      await pause();
      return Object.values(data.trades).filter((t) => (t.initiatorId === uid || t.receiverId === uid) && t.status === "pending" && t.expiresAt > now).length;
    },

    async insertTransfer(toUid, t) {
      await pause();
      if (data.transfers[t.id]) return;
      data.transfers[t.id] = { ...clone(t), to: toUid, claimedAt: null };
      changed();
    },
    async pendingTransfers(uid) {
      await pause();
      return Object.values(data.transfers)
        .filter((t) => t.to === uid && t.claimedAt === null)
        .map(({ to: _to, claimedAt: _c, ...t }) => clone(t));
    },
    async markTransfers(uid, ids, now) {
      await pause();
      for (const id of ids) {
        const t = data.transfers[id];
        if (t && t.to === uid && t.claimedAt === null) t.claimedAt = now;
      }
      changed();
    },

    async recordFootprint(uid, ip, device, now) {
      const f = data.footprints.find((x) => x.uid === uid && x.ip === ip && x.device === device);
      if (f) f.seenAt = now;
      else data.footprints.push({ uid, ip, device, seenAt: now });
      changed();
    },
    async sharedFootprint(a, b, since) {
      const fa = data.footprints.filter((f) => f.uid === a && f.seenAt >= since);
      const fb = data.footprints.filter((f) => f.uid === b && f.seenAt >= since);
      return fa.some((x) => fb.some((y) => (x.ip && x.ip === y.ip) || (x.device && x.device === y.device)));
    },
    async uidByName(lower) {
      return data.names[lower] ?? null;
    },
  };
}
