import { beforeEach, describe, expect, it } from "vitest";
import { MAX_ROLL_BATCH, createPlayerState, normalizePlayerState, seededRng, type PlayerState } from "../shared";
import { handleApi, toApiError, type Caller } from "../functions/src/handlers";
import { DatabaseError, createRestStore } from "./restStore";
import { FakeDatabase } from "./testing/fakeDatabase";

const BASE = "https://rng-aura-test.firebasedatabase.app";
const TOKEN = "jeton-admin-test";
const T0 = 1_700_000_000_000;
const alice: Caller = { uid: "uid-alice", email: "alice@aurarng.local", displayName: "Alice" };

let db: FakeDatabase;
const store = (fetchDb = db) =>
  createRestStore({ databaseUrl: BASE, getAccessToken: async () => TOKEN, fetch: fetchDb.fetch });

beforeEach(() => {
  db = new FakeDatabase({ baseUrl: BASE, token: TOKEN });
});

describe("store REST : opérations de base", () => {
  it("crée puis met à jour un joueur sous v2/players avec écriture conditionnelle", async () => {
    const s = store();
    await s.updatePlayer("uid-alice", () => createPlayerState("Alice", T0));
    const updated = await s.updatePlayer("uid-alice", (raw) => {
      const p = normalizePlayerState(raw, "Alice", T0);
      p.stats.rolls = 5;
      return p;
    });
    expect(updated.stats.rolls).toBe(5);
    expect((db.get("v2/players/uid-alice") as unknown as PlayerState).stats.rolls).toBe(5);
    const puts = db.requests.filter((r) => r.method === "PUT");
    expect(puts.every((r) => r.ifMatch)).toBe(true);
  });

  it("n'écrit rien si la logique serveur lève une erreur", async () => {
    db.set("v2/players/uid-alice", { name: "Alice", stats: { rolls: 3 } });
    const before = JSON.stringify(db.root);
    await expect(
      store().updatePlayer("uid-alice", () => {
        throw new Error("refusé");
      }),
    ).rejects.toThrow("refusé");
    expect(JSON.stringify(db.root)).toBe(before);
    expect(db.requests.some((r) => r.method === "PUT")).toBe(false);
  });

  it("lit les bannissements et ignore les entrées malformées", async () => {
    db.set("bans/uid-alice", { until: T0 + 1000, reason: "triche" });
    db.set("bans/uid-bob", "texte");
    await expect(store().getBan("uid-alice")).resolves.toEqual({ until: T0 + 1000, reason: "triche" });
    await expect(store().getBan("uid-bob")).resolves.toBeNull();
    await expect(store().getBan("uid-carol")).resolves.toBeNull();
  });

  it("écrit le classement sous v2/leaderboard", async () => {
    const entry = { name: "Alice", rolls: 1, bestOdds: 7, bestAuraId: "brise", collection: 1, achievements: 1, equipped: null, updatedAt: T0 };
    await store().writeLeaderboard("uid-alice", entry);
    expect(db.get("v2/leaderboard/uid-alice")).toEqual({ ...entry, equipped: undefined }); // null supprimé en JSON RTDB
  });

  it("réserve un pseudo libre, le garde pour son propriétaire, le refuse aux autres", async () => {
    const s = store();
    await expect(s.claimUsername("alice", "uid-alice", T0)).resolves.toBe(true);
    expect(db.get("usernames/alice")).toEqual({ uid: "uid-alice", createdAt: T0 });
    const writes = db.requests.filter((r) => r.method === "PUT").length;
    await expect(s.claimUsername("alice", "uid-alice", T0 + 5)).resolves.toBe(true);
    expect(db.requests.filter((r) => r.method === "PUT").length).toBe(writes); // aucune réécriture
    await expect(s.claimUsername("alice", "uid-mallory", T0)).resolves.toBe(false);
    expect(db.get("usernames/alice")).toEqual({ uid: "uid-alice", createdAt: T0 });
  });

  it("envoie toujours le jeton d'accès et échoue proprement s'il est refusé", async () => {
    const bad = createRestStore({ databaseUrl: BASE, getAccessToken: async () => "mauvais", fetch: db.fetch });
    await expect(bad.getBan("uid-alice")).rejects.toBeInstanceOf(DatabaseError);
    await expect(bad.updatePlayer("uid-alice", () => createPlayerState("x", T0))).rejects.toBeInstanceOf(DatabaseError);
  });

  it("refuse les clés qui sortiraient du chemin prévu", async () => {
    for (const uid of ["../admins", "a/b", "a.b", "a#b", "a$b", "a[b]", ""]) {
      await expect(store().getBan(uid), uid).rejects.toBeInstanceOf(DatabaseError);
      await expect(store().updatePlayer(uid, () => createPlayerState("x", T0)), uid).rejects.toBeInstanceOf(DatabaseError);
    }
    expect(db.requests).toHaveLength(0);
  });
});

describe("store REST : écritures concurrentes", () => {
  it("recommence quand une autre écriture survient entre la lecture et l'écriture (412)", async () => {
    let injected = false;
    db = new FakeDatabase({
      baseUrl: BASE,
      token: TOKEN,
      beforePut: (path) => {
        if (path === "v2/players/uid-alice" && !injected) {
          injected = true;
          db.set(path, { name: "Alice", stats: { rolls: 100 } }); // écriture concurrente
        }
      },
    });
    db.set("v2/players/uid-alice", { name: "Alice", stats: { rolls: 1 } });
    const result = await store().updatePlayer("uid-alice", (raw) => {
      const p = normalizePlayerState(raw, "Alice", T0);
      p.stats.rolls += 1;
      return p;
    });
    expect(result.stats.rolls).toBe(101); // basé sur la valeur concurrente, pas sur l'ancienne
    expect(db.requests.filter((r) => r.status === 412)).toHaveLength(1);
  });

  it("abandonne après trop de conflits plutôt que d'écraser", async () => {
    let n = 0;
    db = new FakeDatabase({ baseUrl: BASE, token: TOKEN, beforePut: (p) => db.set(p, { conflit: ++n }) });
    const s = createRestStore({ databaseUrl: BASE, getAccessToken: async () => TOKEN, fetch: db.fetch, maxAttempts: 3 });
    await expect(s.updatePlayer("uid-alice", () => createPlayerState("x", T0))).rejects.toThrow(/conflits/);
    expect(db.get("v2/players/uid-alice")).toEqual({ conflit: 3 });
  });

  it("20 rolls simultanés via l'API ne dépassent pas le crédit (mêmes protections que la Cloud Function)", async () => {
    db = new FakeDatabase({ baseUrl: BASE, token: TOKEN, jitterMs: 4 });
    const s = store();
    const call = (data: unknown) =>
      handleApi(alice, data, { store: s, rng: seededRng(3), now: () => T0 }).catch((e) => {
        throw toApiError(e);
      });
    const outcomes = await Promise.allSettled(Array.from({ length: 20 }, () => call({ action: "roll", count: MAX_ROLL_BATCH })));
    const granted = outcomes.reduce((n, o) => n + (o.status === "fulfilled" ? o.value.results!.length : 0), 0);
    const saved = normalizePlayerState(db.get("v2/players/uid-alice"), "?", T0);
    expect(granted).toBe(MAX_ROLL_BATCH);
    expect(saved.stats.rolls).toBe(MAX_ROLL_BATCH);
    expect(Object.values(saved.inventory).reduce((n, e) => n + e.count, 0)).toBe(MAX_ROLL_BATCH);
    expect(db.requests.some((r) => r.status === 412)).toBe(true);
  });

  it("une seule potion en stock bue 10 fois en parallèle : une seule réussite", async () => {
    db = new FakeDatabase({ baseUrl: BASE, token: TOKEN, jitterMs: 4 });
    const s = store();
    const call = (data: unknown) => handleApi(alice, data, { store: s, rng: seededRng(3), now: () => T0 });
    await call({ action: "load" });
    const outcomes = await Promise.allSettled(Array.from({ length: 10 }, () => call({ action: "potion", potionId: "speed" })));
    expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
    expect(normalizePlayerState(db.get("v2/players/uid-alice"), "?", T0).potions.owned.speed).toBe(0);
  });
});
