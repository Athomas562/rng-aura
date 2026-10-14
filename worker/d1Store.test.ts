import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { MAX_ROLL_BATCH, createPlayerState, normalizePlayerState, seededRng, type LeaderboardEntry, type PlayerState } from "../shared";
import { handleApi, toApiError, type Caller } from "../functions/src/handlers";
import { StoreError, createD1Store } from "./d1Store";
import { SqliteD1 } from "./testing/sqliteD1";

const T0 = 1_700_000_000_000;
const alice: Caller = { uid: "uid-alice", email: "alice@aurarng.local", displayName: "Alice" };

let db: SqliteD1;
const saved = (uid: string) => {
  const r = db.row<{ state: string }>("SELECT state FROM players WHERE uid = ?", uid);
  return r ? normalizePlayerState(JSON.parse(r.state), "?", T0) : null;
};
const entry = (over: Partial<LeaderboardEntry> = {}): LeaderboardEntry => ({
  name: "Alice",
  rolls: 1,
  bestOdds: 7,
  bestAuraId: "brise",
  collection: 1,
  achievements: 1,
  equipped: null,
  updatedAt: T0,
  ...over,
});

beforeEach(() => {
  db = new SqliteD1();
});

describe("schéma D1 (migrations/)", () => {
  it("crée les quatre tables et les index du classement", () => {
    const tables = db.rows<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").map((t) => t.name);
    expect(tables).toEqual(["bans", "leaderboard", "players", "usernames"]);
    const indexes = db.rows<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'leaderboard_%'");
    expect(indexes).toHaveLength(4);
  });

  it("peut être réappliqué sur une base remplie sans erreur ni perte de données", () => {
    db.sqlite.exec("INSERT INTO bans (uid, until) VALUES ('x', 1)");
    const migration = readFileSync(new URL("../migrations/0001_init.sql", import.meta.url), "utf8");
    expect(() => db.sqlite.exec(migration)).not.toThrow();
    expect(db.row("SELECT uid FROM bans WHERE uid = 'x'")).toEqual({ uid: "x" });
  });
});

describe("store D1 : opérations de base", () => {
  it("crée puis met à jour un joueur en incrémentant sa version", async () => {
    const s = createD1Store(db, { now: () => T0 });
    await s.updatePlayer("uid-alice", () => createPlayerState("Alice", T0));
    const updated = await s.updatePlayer("uid-alice", (raw) => {
      const p = normalizePlayerState(raw, "Alice", T0);
      p.stats.rolls = 5;
      return p;
    });
    expect(updated.stats.rolls).toBe(5);
    expect(saved("uid-alice")?.stats.rolls).toBe(5);
    expect(db.row<{ version: number }>("SELECT version FROM players WHERE uid = 'uid-alice'")?.version).toBe(2);
  });

  it("n'écrit rien si la logique serveur lève une erreur", async () => {
    const s = createD1Store(db);
    await s.updatePlayer("uid-alice", () => createPlayerState("Alice", T0));
    const before = db.rows("SELECT * FROM players");
    await expect(
      s.updatePlayer("uid-alice", () => {
        throw new Error("refusé");
      }),
    ).rejects.toThrow("refusé");
    expect(db.rows("SELECT * FROM players")).toEqual(before);
  });

  it("lit les bannissements", async () => {
    db.sqlite.prepare("INSERT INTO bans (uid, until, reason) VALUES (?, ?, ?)").run("uid-alice", T0 + 1000, "triche");
    db.sqlite.prepare("INSERT INTO bans (uid, until) VALUES (?, ?)").run("uid-bob", T0 + 1000);
    const s = createD1Store(db);
    await expect(s.getBan("uid-alice")).resolves.toEqual({ until: T0 + 1000, reason: "triche" });
    await expect(s.getBan("uid-bob")).resolves.toEqual({ until: T0 + 1000, reason: undefined });
    await expect(s.getBan("uid-carol")).resolves.toBeNull();
  });

  it("réserve un pseudo libre, le garde pour son propriétaire, le refuse aux autres", async () => {
    const s = createD1Store(db);
    await expect(s.claimUsername("alice", "uid-alice", T0)).resolves.toBe(true);
    await expect(s.claimUsername("alice", "uid-alice", T0 + 5)).resolves.toBe(true);
    await expect(s.claimUsername("alice", "uid-mallory", T0)).resolves.toBe(false);
    expect(db.rows("SELECT * FROM usernames")).toEqual([{ name: "alice", uid: "uid-alice", created_at: T0 }]);
  });

  it("traite les uid et pseudos comme des valeurs, jamais comme du SQL", async () => {
    const s = createD1Store(db);
    const evil = "x'); DROP TABLE players; --";
    await s.updatePlayer(evil, () => createPlayerState("x", T0));
    await s.getBan(evil);
    await s.claimUsername(evil, evil, T0);
    expect(db.row("SELECT uid FROM players WHERE uid = ?", evil)).toBeDefined();
    expect(db.rows("SELECT name FROM sqlite_master WHERE type = 'table'")).toHaveLength(4);
  });
});

describe("store D1 : classement", () => {
  it("trie par catégorie, départage par ancienneté et marque le joueur courant", async () => {
    const s = createD1Store(db);
    await s.writeLeaderboard("uid-a", entry({ name: "a", rolls: 10, bestOdds: 25, updatedAt: T0 + 2 }));
    await s.writeLeaderboard("uid-b", entry({ name: "b", rolls: 50, bestOdds: 1500, updatedAt: T0 + 3 }));
    await s.writeLeaderboard("uid-c", entry({ name: "c", rolls: 10, bestOdds: 7, updatedAt: T0 + 1 }));
    const byRolls = await s.leaderboard("rolls", 50, "uid-a");
    expect(byRolls.map((r) => [r.rank, r.name, r.me])).toEqual([
      [1, "b", false],
      [2, "c", false], // égalité à 10 : le plus ancien d'abord
      [3, "a", true],
    ]);
    expect((await s.leaderboard("bestOdds", 2, "x")).map((r) => r.name)).toEqual(["b", "a"]);
  });

  it("n'expose jamais les uid des joueurs", async () => {
    const s = createD1Store(db);
    await s.writeLeaderboard("uid-secret", entry());
    const [row] = await s.leaderboard("rolls", 10, "autre");
    expect(JSON.stringify(row)).not.toContain("uid-secret");
    expect(Object.keys(row).sort()).toEqual(["achievements", "bestAuraId", "bestOdds", "collection", "equipped", "me", "name", "rank", "rolls"]);
  });

  it("ne remplace pas une entrée plus récente par une plus ancienne", async () => {
    const s = createD1Store(db);
    await s.writeLeaderboard("uid-a", entry({ rolls: 20, updatedAt: T0 + 10 }));
    await s.writeLeaderboard("uid-a", entry({ rolls: 5, updatedAt: T0 + 5 })); // réponse en retard
    expect(db.row<{ rolls: number }>("SELECT rolls FROM leaderboard WHERE uid = 'uid-a'")?.rolls).toBe(20);
  });

  it("refuse une catégorie hors liste blanche (aucune injection dans ORDER BY)", async () => {
    const s = createD1Store(db);
    for (const bad of ["rolls; DROP TABLE players", "__proto__", "name", "uid"]) {
      await expect(s.leaderboard(bad as never, 10, "x"), bad).rejects.toBeInstanceOf(StoreError);
    }
  });
});

describe("store D1 : écritures concurrentes", () => {
  it("recommence quand une autre écriture survient entre la lecture et l'écriture", async () => {
    let injected = false;
    db = new SqliteD1({
      beforeQuery: (sql) => {
        if (sql.startsWith("UPDATE players") && !injected) {
          injected = true;
          db.sqlite
            .prepare("UPDATE players SET state = ?, version = version + 1 WHERE uid = ?")
            .run(JSON.stringify({ ...createPlayerState("Alice", T0), stats: { ...createPlayerState("Alice", T0).stats, rolls: 100 } }), "uid-alice");
        }
      },
    });
    const s = createD1Store(db);
    await s.updatePlayer("uid-alice", () => ({ ...createPlayerState("Alice", T0), stats: { ...createPlayerState("Alice", T0).stats, rolls: 1 } }));
    const result = await s.updatePlayer("uid-alice", (raw) => {
      const p = normalizePlayerState(raw, "Alice", T0);
      p.stats.rolls += 1;
      return p;
    });
    expect(result.stats.rolls).toBe(101); // calculé sur la valeur concurrente, rien n'est perdu
    expect(saved("uid-alice")?.stats.rolls).toBe(101);
  });

  it("abandonne après trop de conflits plutôt que d'écraser", async () => {
    let n = 0;
    db = new SqliteD1({
      beforeQuery: (sql) => {
        if (sql.startsWith("UPDATE players")) db.sqlite.prepare("UPDATE players SET version = version + 1, state = ? WHERE uid = 'uid-alice'").run(`{"conflit":${++n}}`);
      },
    });
    const s = createD1Store(db, { maxAttempts: 3 });
    await s.updatePlayer("uid-alice", () => createPlayerState("x", T0));
    await expect(s.updatePlayer("uid-alice", (raw) => normalizePlayerState(raw, "x", T0))).rejects.toThrow(/conflits/);
    expect(db.row<{ state: string }>("SELECT state FROM players WHERE uid = 'uid-alice'")?.state).toBe('{"conflit":3}');
  });

  it("deux créations simultanées du même joueur n'en gardent qu'une, cohérente", async () => {
    db = new SqliteD1({ jitterMs: 4 });
    const s = createD1Store(db);
    await Promise.all(Array.from({ length: 5 }, () => s.updatePlayer("uid-alice", (raw) => (raw ? (raw as PlayerState) : createPlayerState("Alice", T0)))));
    expect(db.rows("SELECT uid FROM players")).toHaveLength(1);
  });

  it("20 rolls simultanés via l'API ne dépassent pas le crédit", async () => {
    db = new SqliteD1({ jitterMs: 4 });
    const s = createD1Store(db);
    const call = (data: unknown) =>
      handleApi(alice, data, { store: s, rng: seededRng(3), now: () => T0 }).catch((e) => {
        throw toApiError(e);
      });
    const outcomes = await Promise.allSettled(Array.from({ length: 20 }, () => call({ action: "roll", count: MAX_ROLL_BATCH })));
    const granted = outcomes.reduce((n, o) => n + (o.status === "fulfilled" ? o.value.results!.length : 0), 0);
    const p = saved("uid-alice")!;
    expect(granted).toBe(MAX_ROLL_BATCH);
    expect(p.stats.rolls).toBe(MAX_ROLL_BATCH);
    expect(Object.values(p.inventory).reduce((n, e) => n + e.count, 0)).toBe(MAX_ROLL_BATCH);
    expect(db.row<{ rolls: number }>("SELECT rolls FROM leaderboard WHERE uid = 'uid-alice'")?.rolls).toBe(MAX_ROLL_BATCH);
  });

  it("une seule potion en stock bue 10 fois en parallèle : une seule réussite", async () => {
    db = new SqliteD1({ jitterMs: 4 });
    const s = createD1Store(db);
    const call = (data: unknown) => handleApi(alice, data, { store: s, rng: seededRng(3), now: () => T0 });
    await call({ action: "load" });
    const outcomes = await Promise.allSettled(Array.from({ length: 10 }, () => call({ action: "potion", potionId: "speed" })));
    expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
    expect(saved("uid-alice")?.potions.owned.speed).toBe(0);
  });
});
