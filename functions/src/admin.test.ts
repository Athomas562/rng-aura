/**
 * Panneau d'administration : seul l'UID admin peut agir (vérifié côté serveur),
 * les dons sont validés, bornés et appliqués de façon atomique sur le compte visé.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { ADMIN_UIDS, SHARD_CAP, createPlayerState, normalizePlayerState, type LeaderboardEntry, type PlayerState } from "../../shared/index";
import { handleApi, toApiError, type ApiError, type Caller, type PlayerStore } from "./handlers";
import { createMemoryMarket, emptyMarketData } from "./memoryMarket";

const T0 = 1_700_000_000_000;
const ADMIN = ADMIN_UIDS[0];

class Players implements PlayerStore {
  rows = new Map<string, unknown>();
  leaderboard = new Map<string, LeaderboardEntry>();
  async getBan() {
    return null;
  }
  async readPlayer(uid: string) {
    return structuredClone(this.rows.get(uid) ?? null);
  }
  async updatePlayer(uid: string, mutate: (raw: unknown) => PlayerState) {
    const next = mutate(structuredClone(this.rows.get(uid) ?? null));
    this.rows.set(uid, JSON.parse(JSON.stringify(next)));
    return next;
  }
  async writeLeaderboard(uid: string, e: LeaderboardEntry) {
    this.leaderboard.set(uid, e);
  }
  async claimUsername() {
    return true;
  }
  state(uid: string) {
    return normalizePlayerState(this.rows.get(uid) ?? null, "?", T0);
  }
}

let store: Players;
const admin: Caller = { uid: ADMIN, email: "boss@aurarng.local", displayName: "boss" };
const bob: Caller = { uid: "uid-bob", email: "bob@aurarng.local", displayName: "bob" };

const call = (c: Caller, data: unknown) => {
  const data0 = emptyMarketData();
  data0.names = { boss: ADMIN, bob: "uid-bob" };
  return handleApi(c, data, { store, rng: () => 0.5, now: () => T0, market: createMemoryMarket(data0) }).catch((e) => {
    throw toApiError(e);
  });
};
const fails = (p: Promise<unknown>) => p.then(() => null, (e: ApiError) => e);

beforeEach(() => {
  store = new Players();
  for (const [uid, name] of [[ADMIN, "boss"], ["uid-bob", "bob"]]) {
    const s = createPlayerState(name, T0);
    s.shards = 100;
    store.rows.set(uid, JSON.parse(JSON.stringify(s)));
  }
});

describe("panneau admin", () => {
  it("refuse tout autre joueur, même pour se donner à lui-même", async () => {
    const e = await fails(call(bob, { action: "adminGive", target: "bob", grant: { shards: 1_000_000 } }));
    expect(e?.code).toBe("permission-denied");
    expect((await fails(call(bob, { action: "adminLookup", target: "boss" })))?.code).toBe("permission-denied");
    expect(store.state("uid-bob").shards).toBe(100);
  });

  it("consulte un joueur par pseudo ou par UID", async () => {
    expect((await call(admin, { action: "adminLookup", target: "Bob" })).admin).toMatchObject({ uid: "uid-bob", name: "bob", shards: 100 });
    expect((await call(admin, { action: "adminLookup", target: "uid-bob".replace("-", "") }).catch((e) => e)).code).toBe("not-found");
    expect((await fails(call(admin, { action: "adminLookup", target: "personne" })))?.code).toBe("not-found");
    expect((await call(admin, { action: "adminLookup", target: ADMIN })).admin?.name).toBe("boss");
  });

  it("donne éclats, XP, potions et auras à un autre joueur", async () => {
    const res = await call(admin, {
      action: "adminGive",
      target: "bob",
      grant: { shards: 5_000_000, xp: 1234, potions: { luck: 500, xpBoost: 3 }, auras: { phenix: 2, brise: 10 } },
    });
    const s = store.state("uid-bob");
    expect(s.shards).toBe(5_000_100);
    expect(s.xp).toBe(1234);
    expect(s.potions.owned.luck).toBe(500 + (createPlayerState("x", T0).potions.owned.luck ?? 0));
    expect(s.potions.owned.xpBoost).toBe(3 + (createPlayerState("x", T0).potions.owned.xpBoost ?? 0));
    expect(s.inventory.phenix.count).toBe(2);
    expect(s.inventory.brise.count).toBe(10);
    // Une aura donnée compte comme obtenue (codex, meilleure aura), pas comme échangée.
    expect(s.inventory.phenix.traded ?? 0).toBe(0);
    expect(s.codex.phenix).toBeDefined();
    expect(s.stats.bestAuraId).toBe("phenix");
    expect(store.leaderboard.get("uid-bob")?.bestAuraId).toBe("phenix");
    expect(s.ledger[0]).toMatchObject({ amount: 5_000_000, reason: "Administration" });
    // L'admin reçoit son propre état, inchangé, et la vue du joueur modifié.
    expect(res.state.shards).toBe(100);
    expect(res.admin).toMatchObject({ name: "bob", shards: 5_000_100 });
  });

  it("peut se donner à lui-même", async () => {
    const res = await call(admin, { action: "adminGive", target: "boss", grant: { shards: 900 } });
    expect(res.state.shards).toBe(1_000);
  });

  it("un nombre négatif retire, sans descendre sous zéro", async () => {
    await call(admin, { action: "adminGive", target: "bob", grant: { auras: { phenix: 1 } } });
    await call(admin, { action: "adminGive", target: "bob", grant: { shards: -1_000, auras: { phenix: -5 }, potions: { luck: -9_999 } } });
    const s = store.state("uid-bob");
    expect(s.shards).toBe(0);
    expect(s.inventory.phenix).toBeUndefined();
    expect(s.potions.owned.luck ?? 0).toBe(0);
  });

  it("borne et valide chaque don", async () => {
    const bad = async (grant: unknown) => (await fails(call(admin, { action: "adminGive", target: "bob", grant })))?.code;
    expect(await bad({})).toBe("invalid-argument");
    expect(await bad({ shards: 1.5 })).toBe("invalid-argument");
    expect(await bad({ shards: SHARD_CAP + 1 })).toBe("invalid-argument");
    expect(await bad({ potions: { fake: 1 } })).toBe("invalid-argument");
    expect(await bad({ auras: { inconnue: 1 } })).toBe("invalid-argument");
    expect(await bad({ auras: { phenix: 1_001 } })).toBe("invalid-argument");
    await call(admin, { action: "adminGive", target: "bob", grant: { shards: SHARD_CAP } });
    expect(store.state("uid-bob").shards).toBe(SHARD_CAP);
  });
});
