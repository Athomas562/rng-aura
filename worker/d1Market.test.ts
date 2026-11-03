/**
 * Marché sur D1 (SQLite intégré à Node, vraies migrations) : verrous conditionnels,
 * concurrence réelle entre requêtes, anti-mule, migration non destructive.
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { createPlayerState, normalizePlayerState, type PlayerState } from "../shared";
import { handleApi, toApiError, type ApiError, type Caller } from "../functions/src/handlers";
import { createD1Market } from "./d1Market";
import { createD1Store } from "./d1Store";
import { SqliteD1 } from "./testing/sqliteD1";

const T0 = 1_700_000_000_000;
let db: SqliteD1;

const caller = (name: string, ip = `ip-${name}`): Caller => ({ uid: `uid-${name}`, email: `${name}@aurarng.local`, displayName: name, ipHash: ip, deviceHash: `dev-${name}` });

function seed(name: string, mut: (s: PlayerState) => void) {
  const s = createPlayerState(name, T0);
  mut(s);
  db.sqlite.prepare("INSERT INTO players (uid, state, version, updated_at) VALUES (?, ?, 1, ?)").run(`uid-${name}`, JSON.stringify(s), T0);
  db.sqlite.prepare("INSERT INTO usernames (name, uid, created_at) VALUES (?, ?, ?)").run(name, `uid-${name}`, T0);
}
const saved = (name: string) => {
  const r = db.row<{ state: string }>("SELECT state FROM players WHERE uid = ?", `uid-${name}`);
  return normalizePlayerState(r ? JSON.parse(r.state) : null, name, T0);
};

let n = 0;
const call = (c: Caller, data: unknown, now = T0) =>
  handleApi(c, data, { store: createD1Store(db), market: createD1Market(db), rng: () => 0.999999, now: () => now, newId: () => `listing-${String(++n).padStart(6, "0")}` }).catch((e) => {
    throw toApiError(e);
  });
const fails = (p: Promise<unknown>) => p.then(() => null, (e: ApiError) => e);

beforeEach(() => {
  db = new SqliteD1({ jitterMs: 3 });
  n = 0;
  seed("alice", (s) => {
    s.inventory.phenix = { count: 2, firstAt: T0, lastAt: T0, firstRoll: 0 };
    s.codex.phenix = { firstAt: T0, total: 2 };
    s.shards = 1_000;
  });
});

describe("migration 0003", () => {
  it("ne crée que des tables et index (aucune suppression), et peut être rejouée", () => {
    const sql = readFileSync(new URL("../migrations/0003_market.sql", import.meta.url), "utf8");
    expect(sql).not.toMatch(/\b(DROP|DELETE|UPDATE|ALTER)\b/i);
    expect(() => db.sqlite.exec(sql)).not.toThrow();
  });
});

describe("marché sur D1", () => {
  it("vente complète : dépôt, verrou, paiement du vendeur à sa visite", async () => {
    seed("bob", (s) => (s.shards = 5_000));
    await call(caller("alice"), { action: "list", auraId: "phenix", price: 1_000 });
    const id = db.row<{ id: string }>("SELECT id FROM market_listings")!.id;
    await call(caller("bob"), { action: "buyListing", listingId: id });
    await call(caller("alice"), { action: "load" });
    expect(saved("bob").inventory.phenix).toMatchObject({ count: 1, traded: 1 });
    expect(saved("bob").shards).toBe(4_000);
    expect(saved("alice").shards).toBe(1_000 - 10 + 950);
    expect(db.row("SELECT status, buyer_id FROM market_listings WHERE id = ?", id)).toEqual({ status: "sold", buyer_id: "uid-bob" });
    expect(db.row<{ n: number }>("SELECT COUNT(*) AS n FROM transfers WHERE claimed_at IS NULL")!.n).toBe(0);
  });

  it("8 acheteurs simultanés : une seule vente, tous les autres remboursés", async () => {
    for (let i = 0; i < 8; i++) seed(`b${i}`, (s) => (s.shards = 3_000));
    await call(caller("alice"), { action: "list", auraId: "phenix", price: 1_000 });
    const id = db.row<{ id: string }>("SELECT id FROM market_listings")!.id;
    const out = await Promise.all(Array.from({ length: 8 }, (_, i) => fails(call(caller(`b${i}`), { action: "buyListing", listingId: id }))));
    expect(out.filter((x) => x === null)).toHaveLength(1);
    const buyers = Array.from({ length: 8 }, (_, i) => saved(`b${i}`));
    expect(buyers.filter((s) => s.inventory.phenix).length).toBe(1);
    expect(buyers.reduce((sum, s) => sum + s.shards, 0)).toBe(8 * 3_000 - 1_000);
  });

  it("l'anti-mule s'appuie sur les empreintes hachées en base", async () => {
    seed("mule", (s) => (s.shards = 5_000));
    await call(caller("mule", "ip-alice"), { action: "load" });
    await call(caller("alice"), { action: "list", auraId: "phenix", price: 1_000 });
    const id = db.row<{ id: string }>("SELECT id FROM market_listings")!.id;
    expect((await fails(call(caller("mule", "ip-alice"), { action: "buyListing", listingId: id })))?.message).toMatch(/même réseau/);
    expect(db.rows("SELECT * FROM account_footprints WHERE ip_hash = 'ip-alice'")).toHaveLength(2);
  });

  it("retrouve un joueur sans pseudo réservé par son nom au classement", async () => {
    const market = createD1Market(db);
    db.sqlite.exec("INSERT INTO leaderboard (uid, name, rolls, best_odds, collection, achievements, updated_at) VALUES ('uid-old', 'Ancien', 1, 0, 0, 0, 1)");
    expect(await market.uidByName("ancien")).toBe("uid-old");
    expect(await market.uidByName("alice")).toBe("uid-alice");
    expect(await market.uidByName("x' OR 1=1 --")).toBeNull();
  });
});
