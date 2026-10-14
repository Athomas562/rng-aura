/**
 * Chaîne complète du Worker, sans réseau : requête HTTP → vérification du jeton Firebase
 * (clés générées localement) → logique serveur → base D1 de test (SQLite + vraies migrations).
 */
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type CryptoKey } from "jose";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { normalizePlayerState, seededRng, type ApiResponse, type LeaderboardRow } from "../shared";
import { verifyFirebaseIdToken } from "./auth";
import type { D1Database } from "./d1";
import { createD1Store, type D1Store } from "./d1Store";
import { MAX_BODY_BYTES, handleApiRequest, handleLeaderboardRequest, type ApiDeps } from "./http";
import worker, { type Env } from "./index";
import { SqliteD1 } from "./testing/sqliteD1";

const PROJECT = "rng-aura";
const NOW = 1_800_000_000_000;

let signKey: CryptoKey;
let keys: ReturnType<typeof createLocalJWKSet>;
let db: SqliteD1;
let store: D1Store;
let deps: ApiDeps;
let clock: number;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  signKey = pair.privateKey;
  keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256" }] });
});

beforeEach(() => {
  clock = NOW;
  db = new SqliteD1();
  store = createD1Store(db, { now: () => clock });
  deps = {
    verifyToken: (t) => verifyFirebaseIdToken(t, PROJECT, keys, Math.floor(clock / 1000)),
    store,
    rng: seededRng(9),
    now: () => clock,
  };
});

async function idToken(uid = "uid-alice", email = "alice@aurarng.local", name = "Alice") {
  const s = Math.floor(NOW / 1000);
  return new SignJWT({ email, name, auth_time: s - 60 })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(`https://securetoken.google.com/${PROJECT}`)
    .setAudience(PROJECT)
    .setSubject(uid)
    .setIssuedAt(s - 60)
    .setExpirationTime(s + 3000)
    .sign(signKey);
}

type Body<T> = { data?: T; error?: { code: string; message: string; details?: Record<string, unknown> } };

async function post(body: unknown, token?: string | null) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token !== null) headers.Authorization = `Bearer ${token ?? (await idToken())}`;
  const res = await handleApiRequest(
    new Request("https://rng-aura.example/api", { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) }),
    deps,
  );
  return { status: res.status, body: (await res.json()) as Body<ApiResponse> };
}

async function getLeaderboard(query: string, token?: string | null, method = "GET") {
  const headers: Record<string, string> = {};
  if (token !== null) headers.Authorization = `Bearer ${token ?? (await idToken())}`;
  const res = await handleLeaderboardRequest(new Request(`https://rng-aura.example/api/leaderboard${query}`, { method, headers }), {
    verifyToken: deps.verifyToken,
    leaderboard: store.leaderboard,
  });
  return { status: res.status, body: (await res.json()) as Body<LeaderboardRow[]> };
}

const player = (uid: string) => {
  const r = db.row<{ state: string }>("SELECT state FROM players WHERE uid = ?", uid);
  return r ? normalizePlayerState(JSON.parse(r.state), "?", NOW) : null;
};

describe("API du Worker : authentification et validation", () => {
  it("refuse une requête sans jeton, sans toucher à la base", async () => {
    const r = await post({ action: "load" }, null);
    expect(r.status).toBe(401);
    expect(r.body.error?.code).toBe("unauthenticated");
    expect(db.log).toHaveLength(0);
  });

  it("refuse un jeton invalide ou falsifié", async () => {
    expect((await post({ action: "load" }, "a.b.c")).status).toBe(401);
    const other = await generateKeyPair("RS256");
    const forged = await new SignJWT({ auth_time: 1 }).setProtectedHeader({ alg: "RS256", kid: "k1" }).setSubject("uid-admin").sign(other.privateKey);
    expect((await post({ action: "load" }, forged)).status).toBe(401);
    expect(db.log).toHaveLength(0);
  });

  it("refuse les méthodes autres que POST", async () => {
    const res = await handleApiRequest(new Request("https://x/api", { method: "GET" }), deps);
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("POST");
  });

  it("refuse un corps non JSON, invalide ou trop volumineux", async () => {
    expect((await post("pas du json")).status).toBe(400);
    expect((await post([1, 2])).status).toBe(400);
    expect((await post({ action: "load", pad: "x".repeat(MAX_BODY_BYTES) })).status).toBe(413);
    const res = await handleApiRequest(new Request("https://x/api", { method: "POST", headers: { Authorization: `Bearer ${await idToken()}` }, body: "{}" }), deps);
    expect(res.status).toBe(400);
  });

  it("utilise l'identité du jeton, jamais un uid envoyé par le client", async () => {
    const r = await post({ action: "load", uid: "uid-bob" });
    expect(r.status).toBe(200);
    expect(player("uid-alice")).not.toBeNull();
    expect(player("uid-bob")).toBeNull();
  });
});

describe("API du Worker : actions du jeu", () => {
  it("charge, lance un roll et met à jour sauvegarde et classement", async () => {
    expect((await post({ action: "load" })).body.data?.state.name).toBe("Alice");
    const roll = await post({ action: "roll", count: 1, auraId: "ouroboros", luck: 1e9 });
    expect(roll.status).toBe(200);
    expect(roll.body.data?.results).toHaveLength(1);
    expect(roll.body.data?.results?.[0].luck).toBe(1);
    expect(player("uid-alice")?.stats.rolls).toBe(1);
    expect(db.row<{ rolls: number }>("SELECT rolls FROM leaderboard WHERE uid = 'uid-alice'")?.rolls).toBe(1);
  });

  it("renvoie 429 avec le délai restant pendant la recharge", async () => {
    await post({ action: "roll", count: 8 });
    const r = await post({ action: "roll", count: 1 });
    expect(r.status).toBe(429);
    expect(r.body.error?.code).toBe("resource-exhausted");
    expect(r.body.error?.details?.retryInMs).toBeGreaterThan(0);
  });

  it("garde la correction NaN : un count invalide ne remet pas le délai à zéro", async () => {
    await post({ action: "roll", count: 8 });
    await post('{"action":"roll","count":1e999}');
    expect((await post({ action: "roll", count: 8 })).status).toBe(429);
  });

  it("renvoie les erreurs métier avec le bon code HTTP", async () => {
    expect((await post({ action: "potion", potionId: "hack" })).status).toBe(400);
    expect((await post({ action: "equip", auraId: "ouroboros" })).status).toBe(409);
    expect((await post({ action: "register", name: "Bob" })).status).toBe(403);
    expect((await post({ action: "inconnue" })).status).toBe(400);
  });

  it("refuse un joueur banni (table bans de D1) avec la date de fin", async () => {
    db.sqlite.prepare("INSERT INTO bans (uid, until, reason) VALUES (?, ?, ?)").run("uid-alice", NOW + 60_000, "triche");
    const r = await post({ action: "load" });
    expect(r.status).toBe(403);
    expect(r.body.error?.details?.until).toBe(NOW + 60_000);
    expect(player("uid-alice")).toBeNull();
  });

  it("un ban expiré n'empêche plus de jouer", async () => {
    db.sqlite.prepare("INSERT INTO bans (uid, until) VALUES (?, ?)").run("uid-alice", NOW - 1);
    expect((await post({ action: "load" })).status).toBe(200);
  });

  it("enregistre le pseudo du compte dans usernames", async () => {
    expect((await post({ action: "register", name: "Alice" })).status).toBe(200);
    expect(db.row("SELECT uid FROM usernames WHERE name = 'alice'")).toEqual({ uid: "uid-alice" });
  });

  it("répond 500 sans détail si la base est inaccessible", async () => {
    const broken: D1Database = {
      prepare: () => {
        throw new Error("D1 indisponible : détail interne");
      },
      batch: async () => [],
    };
    deps.store = createD1Store(broken);
    const r = await post({ action: "load" });
    expect(r.status).toBe(500);
    expect(r.body.error?.message).toBe("Erreur serveur");
    expect(JSON.stringify(r.body)).not.toContain("détail interne");
  });
});

describe("API du Worker : nom du classement", () => {
  it("le nom vient de l'e-mail du jeton, pas du nom modifiable par le joueur", async () => {
    const token = await idToken("uid-mallory", "mallory@aurarng.local", "Alice");
    const r = await post({ action: "load", name: "Alice" }, token);
    expect(r.body.data?.state.name).toBe("mallory");
    expect(db.row("SELECT name FROM leaderboard WHERE uid = 'uid-mallory'")).toEqual({ name: "mallory" });
  });
});

describe("API du Worker : GET /api/leaderboard", () => {
  beforeEach(async () => {
    await post({ action: "roll", count: 3 }, await idToken("uid-alice", "alice@aurarng.local", "Alice"));
    await post({ action: "roll", count: 1 }, await idToken("uid-bob", "bob@aurarng.local", "bob"));
  });

  it("renvoie le classement trié, sans uid, avec le repère « moi »", async () => {
    const r = await getLeaderboard("?category=rolls&limit=50", await idToken("uid-bob", "bob@aurarng.local", "bob"));
    expect(r.status).toBe(200);
    expect(r.body.data?.map((x) => [x.rank, x.name, x.rolls, x.me])).toEqual([
      [1, "Alice", 3, false],
      [2, "bob", 1, true],
    ]);
    expect(JSON.stringify(r.body)).not.toMatch(/uid-/);
  });

  it("exige une connexion valide", async () => {
    expect((await getLeaderboard("?category=rolls", null)).status).toBe(401);
    expect((await getLeaderboard("?category=rolls", "a.b.c")).status).toBe(401);
  });

  it("n'accepte que GET", async () => {
    const r = await getLeaderboard("", undefined, "POST");
    expect(r.status).toBe(405);
  });

  it.each(["?category=uid", "?category=rolls;DROP%20TABLE%20players", "?category=__proto__", "?limit=0", "?limit=51", "?limit=abc", "?limit=2.5"])(
    "refuse le paramètre invalide %s sans toucher aux tables",
    async (query) => {
      expect((await getLeaderboard(query)).status).toBe(400);
      expect(db.rows("SELECT name FROM sqlite_master WHERE type = 'table'")).toHaveLength(4);
    },
  );

  it("utilise rolls et 50 lignes par défaut", async () => {
    const r = await getLeaderboard("");
    expect(r.status).toBe(200);
    expect(r.body.data?.[0].name).toBe("Alice");
  });
});

describe("routage du Worker", () => {
  const env = (extra: Partial<Env> = {}): Env => ({
    ASSETS: { fetch: async () => new Response("<html>site</html>", { status: 200 }) },
    DB: db,
    FIREBASE_PROJECT_ID: PROJECT,
    ...extra,
  });

  it("sert les fichiers statiques pour tout chemin hors API", async () => {
    for (const path of ["/", "/inventaire", "/apix", "/api-docs"]) {
      const res = await worker.fetch(new Request(`https://x${path}`), env());
      expect(await res.text(), path).toBe("<html>site</html>");
    }
  });

  it("répond 503 sans exposer de détail si la base D1 n'est pas liée", async () => {
    for (const path of ["/api", "/api/leaderboard"]) {
      const res = await worker.fetch(new Request(`https://x${path}`, { method: "POST" }), env({ DB: undefined }));
      expect(res.status, path).toBe(503);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe("unavailable");
    }
  });

  it("route /api et /api/leaderboard vers l'API (refus sans jeton)", async () => {
    expect((await worker.fetch(new Request("https://x/api", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }), env())).status).toBe(401);
    expect((await worker.fetch(new Request("https://x/api/leaderboard"), env())).status).toBe(401);
  });
});
