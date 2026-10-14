import { describe, expect, it } from "vitest";
import { SqliteD1 } from "../testing/sqliteD1";
import { rtdbExportToSql } from "./rtdbImport";

const NOW = 1_800_000_000_000;

/** Export fictif au format de la console Firebase (anciens chemins + v2). */
const exported = {
  bans: {
    "uid-banni": { until: NOW + 1000, reason: "triche" },
    "uid-sans-raison": { until: 9_999_999_999_999 },
    "bad/uid": { until: 1 },
    "uid-malforme": { reason: "pas de date" },
  },
  usernames: {
    alice: { uid: "uid-alice", createdAt: 1_600_000_000_000 },
    "o'brien": { uid: "uid-x" },
    bob: { uid: "uid-bob" },
  },
  v2: {
    players: { "uid-alice": { name: "alice", stats: { rolls: 42 } } },
    leaderboard: {
      "uid-alice": { name: "alice", rolls: 42, bestOdds: 1500, bestAuraId: "phenix", collection: 5, achievements: 3, updatedAt: NOW - 5 },
      "uid-incomplet": { name: "x" },
    },
  },
  players: { "uid-alice": { totalRolls: 9000 } },
  saves: { "uid-alice": { coins: 100 } },
  chat: { m1: { text: "x" } },
};

describe("import d'un export Realtime Database vers D1", () => {
  it("convertit bans, pseudos et données v2, en ignorant les entrées invalides", () => {
    const { counts } = rtdbExportToSql(exported, NOW);
    expect(counts).toEqual({ bans: 2, usernames: 2, players: 1, leaderboard: 1, skipped: 4 });
  });

  it("ne génère que des INSERT OR IGNORE (aucune suppression ni mise à jour)", () => {
    const statements = rtdbExportToSql(exported, NOW).sql.split("\n").filter((l) => l && !l.startsWith("--"));
    for (const s of statements) expect(s).toMatch(/^INSERT OR IGNORE INTO (bans|usernames|players|leaderboard) /);
    expect(rtdbExportToSql(exported, NOW).sql).not.toMatch(/\b(DELETE|DROP|UPDATE|REPLACE)\b/i);
  });

  it("s'exécute sur le schéma réel et produit des données lisibles par le Worker", () => {
    const db = new SqliteD1();
    db.sqlite.exec(rtdbExportToSql(exported, NOW).sql);
    expect(db.row("SELECT until, reason FROM bans WHERE uid = 'uid-banni'")).toEqual({ until: NOW + 1000, reason: "triche" });
    expect(db.row("SELECT uid FROM usernames WHERE name = 'alice'")).toEqual({ uid: "uid-alice" });
    expect(JSON.parse(db.row<{ state: string }>("SELECT state FROM players WHERE uid = 'uid-alice'")!.state).stats.rolls).toBe(42);
    expect(db.row("SELECT rolls, best_odds FROM leaderboard WHERE uid = 'uid-alice'")).toEqual({ rolls: 42, best_odds: 1500 });
  });

  it("n'écrase jamais une donnée déjà présente dans D1, et peut être relancé sans effet", () => {
    const db = new SqliteD1();
    db.sqlite.exec("INSERT INTO bans (uid, until, reason) VALUES ('uid-banni', 5, 'ban plus récent')");
    const { sql } = rtdbExportToSql(exported, NOW);
    db.sqlite.exec(sql);
    db.sqlite.exec(sql);
    expect(db.row("SELECT until, reason FROM bans WHERE uid = 'uid-banni'")).toEqual({ until: 5, reason: "ban plus récent" });
    expect(db.rows("SELECT * FROM bans")).toHaveLength(2);
  });

  it("échappe les apostrophes et rejette les valeurs non numériques (pas d'injection SQL)", () => {
    const hostile = {
      bans: { "uid-1": { until: "1); DROP TABLE players; --", reason: "x" }, "uid-2": { until: 1, reason: "'); DROP TABLE players; --" } },
    };
    const db = new SqliteD1();
    const { sql, counts } = rtdbExportToSql(hostile, NOW);
    db.sqlite.exec(sql);
    expect(counts.bans).toBe(1);
    expect(db.row("SELECT reason FROM bans WHERE uid = 'uid-2'")).toEqual({ reason: "'); DROP TABLE players; --" });
    expect(db.rows("SELECT name FROM sqlite_master WHERE type = 'table'")).toHaveLength(4);
  });

  it("n'importe rien des chemins de l'ancien jeu", () => {
    const { sql } = rtdbExportToSql(exported, NOW);
    expect(sql).not.toContain("totalRolls");
    expect(sql).not.toContain("coins");
  });

  it("accepte un export vide ou invalide sans rien générer", () => {
    for (const input of [null, {}, [], "texte"]) {
      expect(rtdbExportToSql(input, NOW).counts).toEqual({ bans: 0, usernames: 0, players: 0, leaderboard: 0, skipped: 0 });
    }
  });
});
