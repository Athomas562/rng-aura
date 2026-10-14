import { beforeEach, describe, expect, it } from "vitest";
import { seededRng, type LeaderboardEntry, type PlayerState } from "../../shared/index";
import { ApiError, handleApi, toApiError, type Ban, type Caller, type PlayerStore } from "./handlers";

/** Store en mémoire avec la même sémantique que la version Firebase. */
class MemoryStore implements PlayerStore {
  players = new Map<string, unknown>();
  leaderboard = new Map<string, LeaderboardEntry>();
  usernames = new Map<string, string>();
  bans = new Map<string, Ban>();

  async getBan(uid: string) {
    return this.bans.get(uid) ?? null;
  }
  async updatePlayer(uid: string, mutate: (raw: unknown) => PlayerState) {
    const next = mutate(structuredClone(this.players.get(uid) ?? null));
    // passe par JSON comme la Realtime Database
    this.players.set(uid, JSON.parse(JSON.stringify(next)));
    return next;
  }
  async writeLeaderboard(uid: string, entry: LeaderboardEntry) {
    this.leaderboard.set(uid, entry);
  }
  async claimUsername(lower: string, uid: string) {
    const owner = this.usernames.get(lower);
    if (owner && owner !== uid) return false;
    this.usernames.set(lower, uid);
    return true;
  }
}

let store: MemoryStore;
let clock: number;
const alice: Caller = { uid: "u1", email: "alice@aurarng.local", displayName: "Alice" };
const call = (data: unknown, caller = alice) =>
  handleApi(caller, data, { store, rng: seededRng(11), now: () => clock }).catch((e) => {
    throw toApiError(e);
  });

beforeEach(() => {
  store = new MemoryStore();
  clock = 1_700_000_000_000;
});

describe("api", () => {
  it("crée le joueur au premier chargement avec le nom du compte", async () => {
    const res = await call({ action: "load" });
    expect(res.state.name).toBe("Alice");
    expect(res.state.stats.rolls).toBe(0);
    expect(store.leaderboard.get("u1")?.name).toBe("Alice");
  });

  it("lance un roll et persiste le résultat", async () => {
    const res = await call({ action: "roll", count: 1 });
    expect(res.results).toHaveLength(1);
    const saved = (await call({ action: "load" })).state;
    expect(saved.stats.rolls).toBe(1);
    expect(saved.inventory[res.results![0].auraId].count).toBe(1);
    expect(store.leaderboard.get("u1")?.rolls).toBe(1);
  });

  it("refuse un roll trop rapide avec le délai restant", async () => {
    await call({ action: "roll", count: 8 });
    await call({ action: "roll", count: 8 }).catch(() => {});
    const err = await call({ action: "roll", count: 1 }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("resource-exhausted");
    expect(err.details.retryInMs).toBeGreaterThan(0);
  });

  it("ignore toute donnée de résultat envoyée par le client", async () => {
    const res = await call({ action: "roll", count: 1, auraId: "infini", luck: 1e12, state: { stats: { rolls: 1e9 } } });
    expect(res.state.stats.rolls).toBe(1);
    expect(res.results![0].luck).toBe(1);
  });

  it("boit une potion seulement si elle est en stock", async () => {
    const res = await call({ action: "potion", potionId: "speed" });
    expect(res.state.potions.active.speed).toBeGreaterThan(clock);
    const err = await call({ action: "potion", potionId: "speed" }).catch((e) => e);
    expect(err.code).toBe("failed-precondition");
    expect((await call({ action: "potion", potionId: "hack" }).catch((e) => e)).code).toBe("invalid-argument");
  });

  it("n'équipe qu'une aura possédée", async () => {
    const { results } = await call({ action: "roll" });
    const owned = results![0].auraId;
    expect((await call({ action: "equip", auraId: owned })).state.equipped).toBe(owned);
    const notOwned = owned === "ouroboros" ? "infini" : "ouroboros";
    expect((await call({ action: "equip", auraId: notOwned }).catch((e) => e)).code).toBe("failed-precondition");
    expect((await call({ action: "equip", auraId: "../hack" }).catch((e) => e)).code).toBe("invalid-argument");
  });

  it("refuse un joueur banni", async () => {
    store.bans.set("u1", { until: clock + 1000, reason: "triche" });
    const err = await call({ action: "load" }).catch((e) => e);
    expect(err.code).toBe("permission-denied");
    store.bans.set("u1", { until: clock - 1 });
    await expect(call({ action: "load" })).resolves.toBeDefined();
  });

  it("enregistre un pseudo correspondant au compte uniquement", async () => {
    const ok = await call({ action: "register", name: "Alice" });
    expect(ok.state.name).toBe("Alice");
    expect(store.usernames.get("alice")).toBe("u1");
    expect((await call({ action: "register", name: "Bob" }).catch((e) => e)).code).toBe("permission-denied");
    expect((await call({ action: "register", name: "a" }).catch((e) => e)).code).toBe("invalid-argument");
    store.usernames.set("carol", "u9");
    const carol: Caller = { uid: "u3", email: "carol@aurarng.local" };
    expect((await call({ action: "register", name: "Carol" }, carol).catch((e) => e)).code).toBe("already-exists");
  });

  it("isole les joueurs entre eux", async () => {
    await call({ action: "roll" });
    const bob: Caller = { uid: "u2", email: "bob@aurarng.local" };
    const res = await call({ action: "load" }, bob);
    expect(res.state.stats.rolls).toBe(0);
    expect(res.state.name).toBe("bob");
  });

  it("compte le temps de jeu via heartbeat", async () => {
    await call({ action: "heartbeat" });
    clock += 60_000;
    const res = await call({ action: "heartbeat" });
    expect(res.state.stats.playTimeMs).toBe(60_000);
  });

  it("rejette une action inconnue", async () => {
    expect((await call({ action: "giveMeInfinity" }).catch((e) => e)).code).toBe("invalid-argument");
  });
});
