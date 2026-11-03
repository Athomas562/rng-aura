/**
 * Marché et échanges directs, à travers la vraie API serveur (handleApi), avec plusieurs joueurs,
 * un stockage transactionnel en mémoire et des requêtes concurrentes entrelacées.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  LISTING_DURATION_MS,
  MARKET_FLOORS,
  TRADE_TIMEOUT_MS,
  createPlayerState,
  listingFee,
  normalizePlayerState,
  saleTax,
  startPurchase,
  type ApiResponse,
  type LeaderboardEntry,
  type PlayerState,
} from "../../shared/index";
import { handleApi, toApiError, type ApiError, type Caller, type PlayerStore } from "./handlers";
import { createMemoryMarket, type MemoryMarketData } from "./memoryMarket";

class Players implements PlayerStore {
  rows = new Map<string, { v: number; val: unknown }>();
  leaderboard = new Map<string, LeaderboardEntry>();
  async getBan() {
    return null;
  }
  async readPlayer(uid: string) {
    return structuredClone(this.rows.get(uid)?.val ?? null);
  }
  async updatePlayer(uid: string, mutate: (raw: unknown) => PlayerState) {
    for (let i = 0; i < 300; i++) {
      const read = this.rows.get(uid) ?? { v: 0, val: null };
      const next = mutate(structuredClone(read.val));
      await new Promise((r) => setTimeout(r, Math.random() * 2));
      if ((this.rows.get(uid)?.v ?? 0) !== read.v) continue;
      this.rows.set(uid, { v: read.v + 1, val: JSON.parse(JSON.stringify(next)) });
      return next;
    }
    throw new Error("conflits");
  }
  async writeLeaderboard(uid: string, e: LeaderboardEntry) {
    this.leaderboard.set(uid, e);
  }
  async claimUsername() {
    return true;
  }
  state(uid: string) {
    return normalizePlayerState(this.rows.get(uid)?.val ?? null, "?", 0);
  }
  seed(uid: string, name: string, mut: (s: PlayerState) => void) {
    const s = createPlayerState(name, T0);
    mut(s);
    this.rows.set(uid, { v: 1, val: JSON.parse(JSON.stringify(s)) });
  }
}

const T0 = 1_700_000_000_000; // hors saison (14 novembre 2023)
let clock: number;
let store: Players;
let market: ReturnType<typeof createMemoryMarket>;
let ids = 0;

const who = (name: string, ip = `ip-${name}`): Caller => ({ uid: `uid-${name}`, email: `${name}@aurarng.local`, displayName: name, ipHash: ip, deviceHash: `dev-${name}` });
const alice = () => who("alice");
const bob = () => who("bob");
const carol = () => who("carol");

const call = (caller: Caller, data: unknown) =>
  handleApi(caller, data, { store, rng: () => 0.999999, now: () => clock, market, newId: () => `id-${String(++ids).padStart(8, "0")}` }).catch((e) => {
    throw toApiError(e);
  });
const fails = (p: Promise<unknown>) => p.then(() => null, (e: ApiError) => e);

function give(s: PlayerState, auraId: string, count: number) {
  s.inventory[auraId] = { count, firstAt: T0, lastAt: T0, firstRoll: 0 };
  s.codex[auraId] = { firstAt: T0, total: count };
}

beforeEach(() => {
  clock = T0;
  ids = 0;
  store = new Players();
  const data: MemoryMarketData = { listings: {}, trades: {}, transfers: {}, footprints: [], names: { alice: "uid-alice", bob: "uid-bob", carol: "uid-carol" } };
  market = createMemoryMarket(data, { jitterMs: 2 });
  store.seed("uid-alice", "alice", (s) => {
    give(s, "phenix", 3);
    give(s, "lueur", 10);
    give(s, "geyser", 2); // fusion
    give(s, "citrouille", 2); // saisonnière (hors saison à T0)
    s.equipped = "lueur";
    s.shards = 5_000;
  });
  store.seed("uid-bob", "bob", (s) => {
    give(s, "abysse", 2);
    s.shards = 100_000;
  });
  store.seed("uid-carol", "carol", (s) => {
    s.shards = 100_000;
  });
});

async function listPhenix(price = 2_000) {
  await call(alice(), { action: "list", auraId: "phenix", price });
  return Object.values(market.data.listings).at(-1)!.id;
}

describe("mise en vente", () => {
  it("met l'aura en dépôt, débite 1 % de frais (minimum 10) et l'affiche aux autres", async () => {
    const id = await listPhenix(2_000);
    const a = store.state("uid-alice");
    expect(a.inventory.phenix.count).toBe(2);
    expect(a.escrow[id].auras).toEqual([{ auraId: "phenix", traded: false }]);
    expect(a.shards).toBe(5_000 - 20);
    expect(listingFee(500)).toBe(10);
    const view = (await call(bob(), { action: "market" })) as ApiResponse;
    expect(view.market!.listings).toEqual([expect.objectContaining({ id, sellerName: "alice", auraId: "phenix", price: 2_000, mine: false })]);
    expect(JSON.stringify(view.market)).not.toContain("uid-");
  });

  it("refuse sous le prix plancher, au-dessus du maximum, et les prix non entiers", async () => {
    expect(MARKET_FLOORS.legendary).toBe(1_000);
    for (const price of [999, 0, -5, 1.5, 3e9]) {
      const err = await fails(call(alice(), { action: "list", auraId: "phenix", price }));
      expect(err, String(price)).not.toBeNull();
    }
    expect(store.state("uid-alice").inventory.phenix.count).toBe(3);
    expect(store.state("uid-alice").shards).toBe(5_000);
  });

  it("refuse une aura équipée (dernier exemplaire), de fusion ou saisonnière hors saison", async () => {
    store.seed("uid-alice", "alice", (s) => {
      give(s, "phenix", 1);
      give(s, "geyser", 2);
      give(s, "citrouille", 2);
      s.equipped = "phenix";
      s.shards = 5_000;
    });
    for (const auraId of ["phenix", "geyser", "citrouille"]) {
      const err = await fails(call(alice(), { action: "list", auraId, price: 1_000_000 }));
      expect(err?.code, auraId).toBe("failed-precondition");
    }
    expect(Object.keys(market.data.listings)).toHaveLength(0);
  });

  it("une aura en dépôt ne peut pas être vendue deux fois", async () => {
    await listPhenix();
    await listPhenix();
    await listPhenix();
    const err = await fails(call(alice(), { action: "list", auraId: "phenix", price: 2_000 }));
    expect(err?.code).toBe("failed-precondition");
    expect(store.state("uid-alice").inventory.phenix).toBeUndefined();
  });
});

describe("achat", () => {
  it("transfère l'aura (marquée « obtenue par échange ») et paie le vendeur, taxe de 5 % déduite", async () => {
    const id = await listPhenix(2_000);
    await call(bob(), { action: "buyListing", listingId: id });
    const b = store.state("uid-bob");
    expect(b.shards).toBe(100_000 - 2_000);
    expect(b.inventory.phenix).toMatchObject({ count: 1, traded: 1 });
    // le vendeur encaisse à sa prochaine visite
    await call(alice(), { action: "load" });
    const a = store.state("uid-alice");
    expect(saleTax(2_000)).toBe(100);
    expect(a.shards).toBe(5_000 - 20 + 1_900);
    expect(a.escrow[id]).toBeUndefined();
    expect(market.data.listings[id].status).toBe("sold");
  });

  it("une aura achetée ne compte ni au codex, ni au record du classement « aura la plus rare »", async () => {
    store.seed("uid-alice", "alice", (s) => {
      give(s, "omega", 2);
      s.shards = 100_000_000;
    });
    store.seed("uid-bob", "bob", (s) => {
      give(s, "phenix", 1);
      s.stats.bestAuraId = "phenix";
      s.shards = 900_000_000;
    });
    await call(alice(), { action: "list", auraId: "omega", price: 800_000_000 });
    const id = Object.keys(market.data.listings)[0];
    await call(bob(), { action: "buyListing", listingId: id });
    const b = store.state("uid-bob");
    expect(b.inventory.omega).toMatchObject({ count: 1, traded: 1 });
    expect(b.codex.omega).toBeUndefined();
    expect(b.stats.bestAuraId).toBe("phenix");
    expect(store.leaderboard.get("uid-bob")?.bestOdds ?? 1_500).toBe(1_500);
  });

  it("10 acheteurs simultanés : un seul obtient l'aura, les autres sont remboursés", async () => {
    const id = await listPhenix(2_000);
    for (let i = 0; i < 10; i++) store.seed(`uid-buyer${i}`, `buyer${i}`, (s) => (s.shards = 10_000));
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => fails(call(who(`buyer${i}`), { action: "buyListing", listingId: id }))));
    expect(results.filter((r) => r === null)).toHaveLength(1);
    const owners = Array.from({ length: 10 }, (_, i) => store.state(`uid-buyer${i}`));
    expect(owners.filter((s) => s.inventory.phenix).length).toBe(1);
    expect(owners.reduce((sum, s) => sum + s.shards, 0)).toBe(10 * 10_000 - 2_000);
    expect(owners.every((s) => Object.keys(s.purchases).length === 0)).toBe(true);
  });

  it("solde insuffisant : rien ne change, l'annonce reste en vente", async () => {
    const id = await listPhenix(2_000);
    store.seed("uid-carol", "carol", (s) => (s.shards = 1_999));
    const err = await fails(call(carol(), { action: "buyListing", listingId: id }));
    expect(err?.code).toBe("failed-precondition");
    expect(store.state("uid-carol").shards).toBe(1_999);
    expect(market.data.listings[id].status).toBe("active");
  });

  it("impossible d'acheter sa propre annonce", async () => {
    const id = await listPhenix();
    expect((await fails(call(alice(), { action: "buyListing", listingId: id })))?.code).toBe("failed-precondition");
  });

  it("achat interrompu après le débit : remboursé automatiquement à la visite suivante", async () => {
    const id = await listPhenix(2_000);
    // simulate : débit fait, puis plantage avant le verrou
    await store.updatePlayer("uid-carol", (raw) => {
      const s = normalizePlayerState(raw, "carol", clock);
      startPurchase(s, id, 2_000, "phenix", clock);
      return s;
    });
    expect(store.state("uid-carol").shards).toBe(98_000);
    clock += 61_000;
    await call(carol(), { action: "load" });
    expect(store.state("uid-carol").shards).toBe(100_000);
    expect(market.data.listings[id].status).toBe("active");
  });

  it("achat interrompu après le verrou : l'acheteur reçoit l'aura et le vendeur est payé", async () => {
    const id = await listPhenix(2_000);
    await store.updatePlayer("uid-carol", (raw) => {
      const s = normalizePlayerState(raw, "carol", clock);
      startPurchase(s, id, 2_000, "phenix", clock);
      return s;
    });
    await market.claimListing(id, "uid-carol", clock);
    await call(carol(), { action: "load" });
    expect(store.state("uid-carol").inventory.phenix?.count).toBe(1);
    await call(alice(), { action: "load" });
    expect(store.state("uid-alice").shards).toBe(5_000 - 20 + 1_900);
  });

  it("le paiement du vendeur n'est crédité qu'une fois, même encaissé en parallèle", async () => {
    const id = await listPhenix(2_000);
    await call(bob(), { action: "buyListing", listingId: id });
    await Promise.all(Array.from({ length: 6 }, () => call(alice(), { action: "load" })));
    expect(store.state("uid-alice").shards).toBe(5_000 - 20 + 1_900);
  });
});

describe("expiration et retrait", () => {
  it("après 48 h, l'annonce expire et l'aura revient au vendeur (frais non remboursés)", async () => {
    const id = await listPhenix(2_000);
    clock += LISTING_DURATION_MS + 1;
    expect((await fails(call(bob(), { action: "buyListing", listingId: id })))?.code).toBe("failed-precondition");
    await call(alice(), { action: "load" });
    const a = store.state("uid-alice");
    expect(a.inventory.phenix.count).toBe(3);
    expect(a.escrow[id]).toBeUndefined();
    expect(a.shards).toBe(5_000 - 20);
    expect(market.data.listings[id].status).toBe("expired");
  });

  it("le vendeur peut retirer son annonce : l'aura revient, l'annonce n'est plus achetable", async () => {
    const id = await listPhenix(2_000);
    await call(alice(), { action: "unlist", listingId: id });
    expect(store.state("uid-alice").inventory.phenix.count).toBe(3);
    expect((await fails(call(bob(), { action: "buyListing", listingId: id })))?.code).toBe("failed-precondition");
    expect((await fails(call(bob(), { action: "unlist", listingId: id })))?.code).toBe("failed-precondition");
  });
});

describe("anti-mule", () => {
  it("refuse la vente entre deux comptes vus sur la même IP dans les 24 h", async () => {
    const id = await listPhenix(2_000);
    const mule: Caller = { ...bob(), ipHash: "ip-alice" };
    await call(mule, { action: "load" });
    expect((await fails(call(bob(), { action: "buyListing", listingId: id })))?.message).toMatch(/même réseau ou appareil/);
    expect(store.state("uid-bob").shards).toBe(100_000);
  });

  it("refuse aussi le même appareil, et l'échange direct", async () => {
    await call({ ...bob(), deviceHash: "dev-alice" }, { action: "load" });
    await call(alice(), { action: "load" });
    expect((await fails(call(alice(), { action: "tradeCreate", receiver: "bob", auras: ["phenix"] })))?.message).toMatch(/même réseau/);
  });

  it("au-delà de 24 h, la vente redevient possible", async () => {
    await call({ ...bob(), ipHash: "ip-alice" }, { action: "load" });
    clock += 24 * 3_600_000 + 1;
    const id = await listPhenix(2_000);
    expect(await fails(call(bob(), { action: "buyListing", listingId: id }))).toBeNull();
  });
});

describe("échanges directs", () => {
  async function openTrade() {
    await call(alice(), { action: "tradeCreate", receiver: "bob", auras: ["phenix", "phenix"] });
    const t = Object.values(market.data.trades)[0];
    await call(bob(), { action: "tradeOffer", tradeId: t.id, auras: ["abysse"] });
    return { ...market.data.trades[t.id] }; // copie figée (version au moment de l’ouverture)
  }

  it("double confirmation obligatoire : une seule confirmation n'échange rien", async () => {
    const t = await openTrade();
    await call(alice(), { action: "tradeConfirm", tradeId: t.id, version: t.version });
    expect(store.state("uid-bob").inventory.phenix).toBeUndefined();
    expect(store.state("uid-alice").inventory.phenix.count).toBe(1); // 2 en dépôt
    expect(market.data.trades[t.id].status).toBe("pending");
  });

  it("deux confirmations de la même version : les auras sont échangées", async () => {
    const t = await openTrade();
    await call(alice(), { action: "tradeConfirm", tradeId: t.id, version: t.version });
    await call(bob(), { action: "tradeConfirm", tradeId: t.id, version: t.version });
    await call(alice(), { action: "load" });
    const a = store.state("uid-alice");
    const b = store.state("uid-bob");
    expect(a.inventory.phenix.count).toBe(1);
    expect(a.inventory.abysse).toMatchObject({ count: 1, traded: 1 });
    expect(b.inventory.phenix).toMatchObject({ count: 2, traded: 2 });
    expect(b.inventory.abysse.count).toBe(1);
    expect(a.escrow).toEqual({});
    expect(b.escrow).toEqual({});
    expect(market.data.trades[t.id].status).toBe("accepted");
  });

  it("changer son offre annule les confirmations et rend les auras en dépôt", async () => {
    const t = await openTrade();
    await call(alice(), { action: "tradeConfirm", tradeId: t.id, version: t.version });
    await call(bob(), { action: "tradeOffer", tradeId: t.id, auras: [] });
    // l'ancienne version ne peut plus être confirmée
    expect((await fails(call(bob(), { action: "tradeConfirm", tradeId: t.id, version: t.version })))?.code).toBe("failed-precondition");
    await call(alice(), { action: "load" });
    expect(store.state("uid-alice").inventory.phenix.count).toBe(3);
    expect(market.data.trades[t.id].initiatorConfirmed).toBe(false);
  });

  it("sans validation pendant 3 min, l'échange expire et les auras reviennent", async () => {
    const t = await openTrade();
    await call(alice(), { action: "tradeConfirm", tradeId: t.id, version: t.version });
    clock += TRADE_TIMEOUT_MS + 1;
    expect((await fails(call(bob(), { action: "tradeConfirm", tradeId: t.id, version: t.version })))?.code).toBe("failed-precondition");
    await call(alice(), { action: "load" });
    expect(store.state("uid-alice").inventory.phenix.count).toBe(3);
    expect(market.data.trades[t.id].status).toBe("expired");
    expect(store.state("uid-bob").inventory.abysse.count).toBe(2);
  });

  it("annulation par l'un ou refus par l'autre : rien n'est échangé", async () => {
    const t = await openTrade();
    await call(alice(), { action: "tradeConfirm", tradeId: t.id, version: t.version });
    await call(bob(), { action: "tradeCancel", tradeId: t.id });
    expect(market.data.trades[t.id].status).toBe("declined");
    await call(alice(), { action: "load" });
    expect(store.state("uid-alice").inventory.phenix.count).toBe(3);
  });

  it("5 auras par côté au maximum, auras non échangeables refusées", async () => {
    expect((await fails(call(alice(), { action: "tradeCreate", receiver: "bob", auras: Array(6).fill("lueur") })))?.code).toBe("invalid-argument");
    for (const auraId of ["geyser", "citrouille"]) {
      expect((await fails(call(alice(), { action: "tradeCreate", receiver: "bob", auras: [auraId] })))?.code, auraId).toBe("failed-precondition");
    }
    // lueur équipée : 9 échangeables sur 10, mais 5 au maximum par échange
    expect(await fails(call(alice(), { action: "tradeCreate", receiver: "bob", auras: Array(5).fill("lueur") }))).toBeNull();
  });

  it("l'inventaire du partenaire montre les vrais ids (jamais « ??? ») et seulement aux participants", async () => {
    const t = await openTrade();
    const res = (await call(bob(), { action: "tradePartner", tradeId: t.id })) as ApiResponse;
    expect(res.partner).toEqual({ name: "alice", auras: { phenix: 3, lueur: 9 } });
    expect((await fails(call(carol(), { action: "tradePartner", tradeId: t.id })))?.code).toBe("failed-precondition");
  });

  it("confirmations simultanées des deux côtés : un seul échange, aucune aura dupliquée", async () => {
    const t = await openTrade();
    await Promise.all([
      call(alice(), { action: "tradeConfirm", tradeId: t.id, version: t.version }),
      call(bob(), { action: "tradeConfirm", tradeId: t.id, version: t.version }),
    ]);
    await Promise.all([call(alice(), { action: "load" }), call(bob(), { action: "load" })]);
    const a = store.state("uid-alice");
    const b = store.state("uid-bob");
    expect((a.inventory.phenix?.count ?? 0) + (b.inventory.phenix?.count ?? 0)).toBe(3);
    expect((a.inventory.abysse?.count ?? 0) + (b.inventory.abysse?.count ?? 0)).toBe(2);
    expect(a.inventory.abysse?.count).toBe(1);
  });

  it("échange avec soi-même, pseudo inconnu ou invalide refusés", async () => {
    expect((await fails(call(alice(), { action: "tradeCreate", receiver: "alice", auras: [] })))?.code).toBe("failed-precondition");
    expect((await fails(call(alice(), { action: "tradeCreate", receiver: "personne", auras: [] })))?.code).toBe("failed-precondition");
    expect((await fails(call(alice(), { action: "tradeCreate", receiver: "<b>", auras: [] })))?.code).toBe("invalid-argument");
  });
});
