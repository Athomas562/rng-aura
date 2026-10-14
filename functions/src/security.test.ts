/**
 * Tests de sécurité de l'API de jeu — exécutés uniquement en mémoire.
 * Aucun module Firebase n'est chargé : toute tentative d'import fait échouer le fichier.
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AURAS,
  MAX_ROLL_BATCH,
  POTIONS,
  POTION_IDS,
  computeDistribution,
  computeLuck,
  createPlayerState,
  getRarity,
  normalizePlayerState,
  previewNextLuck,
  probabilityOf,
  type LeaderboardEntry,
  type PlayerState,
} from "../../shared/index";
import { ApiError, handleApi, toApiError, type Ban, type Caller, type PlayerStore } from "./handlers";

// Garde-fou : ces tests ne doivent jamais toucher au vrai projet Firebase.
vi.mock("firebase-admin/app", () => {
  throw new Error("firebase-admin interdit dans les tests de sécurité");
});
vi.mock("firebase-admin/database", () => {
  throw new Error("firebase-admin interdit dans les tests de sécurité");
});
vi.mock("firebase-functions/v2/https", () => {
  throw new Error("firebase-functions interdit dans les tests de sécurité");
});

/**
 * Store en mémoire reproduisant les transactions optimistes de la Realtime Database :
 * lecture d'une version, pause (pour entrelacer les requêtes), puis écriture
 * seulement si personne n'a écrit entre-temps — sinon on recommence.
 */
class TransactionalStore implements PlayerStore {
  private players = new Map<string, { v: number; val: unknown }>();
  leaderboard = new Map<string, LeaderboardEntry>();
  usernames = new Map<string, string>();
  bans = new Map<string, Ban>();
  retries = 0;

  async getBan(uid: string) {
    return this.bans.get(uid) ?? null;
  }

  async updatePlayer(uid: string, mutate: (raw: unknown) => PlayerState) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const read = this.players.get(uid) ?? { v: 0, val: null };
      const next = mutate(structuredClone(read.val)); // peut lever : transaction annulée
      await new Promise((r) => setTimeout(r, Math.random() * 3));
      const current = this.players.get(uid) ?? { v: 0, val: null };
      if (current.v !== read.v) {
        this.retries++;
        continue;
      }
      // sérialisation JSON comme la base réelle (NaN → null, undefined supprimé)
      this.players.set(uid, { v: read.v + 1, val: JSON.parse(JSON.stringify(next)) });
      return next;
    }
    throw new Error("transaction : trop de tentatives");
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

  stored(uid: string): PlayerState {
    return normalizePlayerState(this.players.get(uid)?.val ?? null, "?", 0);
  }

  raw(uid: string): unknown {
    return this.players.get(uid)?.val;
  }
}

const T0 = 1_700_000_000_000;
const player: Caller = { uid: "test-uid", email: "testeur@aurarng.local", displayName: "Testeur" };

let store: TransactionalStore;
let clock: number;
let nextU: number;

/** Appel à l'API ; `u` fixe le tirage aléatoire (RNG injecté). */
const call = (data: unknown, caller = player) =>
  handleApi(caller, data, { store, rng: () => nextU, now: () => clock }).catch((e) => {
    throw toApiError(e);
  });

const rejected = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e as ApiError);

/** Valeur de `u` qui tombe au milieu de la tranche d'une aura pour une chance donnée. */
function uFor(auraId: string, luck: number): number {
  let acc = 0;
  for (const { aura, p } of computeDistribution(luck)) {
    if (aura.id === auraId) {
      if (p === 0) throw new Error(`${auraId} impossible avec une chance de ${luck}`);
      return acc + p / 2;
    }
    acc += p;
  }
  throw new Error(`aura inconnue ${auraId}`);
}

/** Lance un roll qui doit donner `auraId`, en tenant compte de la chance réelle du prochain roll. */
async function rollExactly(auraId: string) {
  clock += 1_000;
  const luck = previewNextLuck(store.stored(player.uid), clock).total;
  nextU = uFor(auraId, luck);
  return call({ action: "roll", count: 1 });
}

beforeEach(() => {
  store = new TransactionalStore();
  clock = T0;
  nextU = 0.999999; // par défaut : une aura commune
});

// ─────────────────────────────────────────────────────────────

describe("probabilités des 32 auras", () => {
  it("le catalogue contient exactement 32 auras, toutes obtenables à chance ×1", () => {
    expect(AURAS).toHaveLength(32);
    const dist = computeDistribution(1);
    for (const a of AURAS) expect(probabilityOf(a.id, 1), a.id).toBeGreaterThan(0);
    expect(dist.reduce((s, e) => s + e.p, 0)).toBeCloseTo(1, 12);
  });

  it("chaque aura rare vaut exactement 1/N à chance ×1", () => {
    for (const a of AURAS.filter((x) => !x.fallback)) expect(probabilityOf(a.id, 1), a.id).toBeCloseTo(1 / a.odds, 15);
  });

  it("la chance maximale atteignable est ×25,2 et Ouroboros demande ~10 M de rolls", () => {
    const s = createPlayerState("x", T0);
    for (const id of POTION_IDS) s.potions.active[id] = T0 + 60_000;
    // potions (1 + 1 + 4) + série plafonnée (+0,3), × sablier 2, × roll béni 2
    const max = computeLuck(s, T0, 10, 10_000).total;
    expect(max).toBeCloseTo(25.2, 10);
    const expectedRolls = 1 / probabilityOf("ouroboros", max);
    expect(expectedRolls).toBeGreaterThan(9.8e6);
    expect(expectedRolls).toBeLessThan(10e6);
    // avec l'élixir de célérité (450 ms par roll), en continu : ~52 jours
    const days = (expectedRolls * 0.45) / 86_400;
    expect(days).toBeGreaterThan(50);
  });

  it("un joueur peut obtenir les 32 auras via le vrai chemin serveur", async () => {
    for (const a of AURAS) {
      const res = await rollExactly(a.id);
      expect(res.results![0].auraId).toBe(a.id);
      expect(res.results![0].isNew).toBe(true);
    }
    const s = store.stored(player.uid);
    expect(Object.keys(s.inventory)).toHaveLength(32);
    expect(s.achievements.collect_all).toBeDefined();
    expect(s.achievements.beyond).toBeDefined();
    expect(s.stats.bestAuraId).toBe("ouroboros");
    expect(store.leaderboard.get(player.uid)).toMatchObject({ collection: 32, bestOdds: 250_000_000, rolls: 32 });
  });
});

describe("falsification du résultat d'un roll", () => {
  it("ignore une aura, une chance ou un état envoyés par le client", async () => {
    const res = await call({
      action: "roll",
      count: 1,
      auraId: "ouroboros",
      results: [{ auraId: "infini" }],
      luck: 1e12,
      state: { inventory: { infini: { count: 99 } }, stats: { rolls: 1e9 } },
      potions: { active: { superLuck: Number.MAX_SAFE_INTEGER } },
    });
    expect(res.results![0].auraId).not.toBe("ouroboros");
    expect(res.results![0].luck).toBe(1);
    const s = store.stored(player.uid);
    expect(s.stats.rolls).toBe(1);
    expect(s.inventory.infini).toBeUndefined();
    expect(s.potions.active.superLuck).toBeUndefined();
  });

  it("rejette l'équipement d'une aura inexistante ou non possédée", async () => {
    await call({ action: "roll", count: 1 });
    for (const auraId of ["fausse_aura", "../inventory", "__proto__", "", 42, { id: "infini" }]) {
      expect((await rejected(call({ action: "equip", auraId })))?.code, String(auraId)).toBe("invalid-argument");
    }
    expect((await rejected(call({ action: "equip", auraId: "infini" })))?.code).toBe("failed-precondition");
    expect(store.stored(player.uid).equipped).not.toBe("infini");
  });

  it("rejette une action inconnue ou une potion inventée", async () => {
    expect((await rejected(call({ action: "giveAura", auraId: "infini" })))?.code).toBe("invalid-argument");
    expect((await rejected(call({ action: "potion", potionId: "infiniteLuck" })))?.code).toBe("invalid-argument");
    expect((await rejected(call({ action: "potion", potionId: "__proto__" })))?.code).toBe("invalid-argument");
  });

  it("ne permet pas de prendre le pseudo d'un autre compte", async () => {
    expect((await rejected(call({ action: "register", name: "Admin" })))?.code).toBe("permission-denied");
    store.usernames.set("testeur", "autre-uid");
    expect((await rejected(call({ action: "register", name: "Testeur" })))?.code).toBe("already-exists");
  });
});

describe("chance falsifiée", () => {
  it("la chance ne vient que des potions réellement bues et stockées", async () => {
    await call({ action: "roll", count: 1, luck: 999 });
    clock += 1_000;
    const res = await call({ action: "roll", count: 1, luck: 999, blessed: true });
    expect(res.results![0].luck).toBeCloseTo(1.0, 5); // série de 2 : pas encore de bonus
    await call({ action: "potion", potionId: "luck" });
    clock += 1_000;
    const boosted = await call({ action: "roll", count: 1 });
    expect(boosted.results![0].luck).toBe(2);
  });

  it("une potion expire à l'heure prévue côté serveur", async () => {
    await call({ action: "potion", potionId: "luck" });
    clock += POTIONS.luck.durationMs + 1;
    const res = await call({ action: "roll", count: 1 });
    expect(res.results![0].luck).toBe(1);
  });
});

describe("rolls excessifs et délai entre rolls", () => {
  it("plafonne une requête à MAX_ROLL_BATCH rolls", async () => {
    const res = await call({ action: "roll", count: 1_000_000 });
    expect(res.results).toHaveLength(MAX_ROLL_BATCH);
  });

  it("refuse un roll pendant la recharge, avec le délai restant", async () => {
    await call({ action: "roll", count: MAX_ROLL_BATCH });
    const err = await rejected(call({ action: "roll", count: 1 }));
    expect(err?.code).toBe("resource-exhausted");
    expect(err?.details?.retryInMs).toBeGreaterThan(0);
  });

  it("un client qui spamme pendant 60 s ne dépasse pas ~1 roll / 900 ms", async () => {
    const end = clock + 60_000;
    while (clock < end) {
      await call({ action: "roll", count: MAX_ROLL_BATCH }).catch(() => {});
      clock += 50;
    }
    const rolls = store.stored(player.uid).stats.rolls;
    expect(rolls).toBeLessThanOrEqual(MAX_ROLL_BATCH + Math.ceil(60_000 / 900) + 1);
  });

  it.each([
    ["négatif", -5],
    ["zéro", 0],
  ])("count %s : aucun roll accordé", async (_label, count) => {
    expect((await rejected(call({ action: "roll", count })))?.code).toBe("resource-exhausted");
    expect(store.stored(player.uid).stats.rolls).toBe(0);
  });

  it.each([
    ["décimal", 2.9, 2],
    ["chaîne", "8", 1],
    ["null", null, 1],
    ["Infinity (JSON 1e999) → invalide, 1 par défaut", JSON.parse('{"c":1e999}').c, 1],
  ])("count %s : nombre de rolls borné", async (_label, count, expected) => {
    const res = await call({ action: "roll", count });
    expect(res.results).toHaveLength(expected);
  });

  it("via le protocole JSON, NaN devient null puis 1 roll", async () => {
    const data = JSON.parse(JSON.stringify({ action: "roll", count: Number.NaN }));
    const res = await call(data);
    expect(res.results).toHaveLength(1);
  });

  it("count NaN (appel direct) ne doit pas remettre à zéro le délai", async () => {
    await call({ action: "roll", count: MAX_ROLL_BATCH }); // vide le crédit
    await call({ action: "roll", count: Number.NaN }).catch(() => {});
    const err = await rejected(call({ action: "roll", count: MAX_ROLL_BATCH }));
    expect(err?.code, "le crédit de rolls a été réinitialisé par une requête NaN").toBe("resource-exhausted");
  });
});

describe("récompenses réclamées plusieurs fois", () => {
  it("un succès n'est accordé (et récompensé) qu'une fois, même en rejouant les appels", async () => {
    await call({ action: "roll", count: 1 });
    const after = store.stored(player.uid);
    expect(after.achievements.first_roll).toBeDefined();
    const luckPotions = after.potions.owned.luck;
    for (let i = 0; i < 10; i++) {
      clock += 30_000;
      await call({ action: "heartbeat" });
      await call({ action: "load" });
    }
    expect(store.stored(player.uid).potions.owned.luck).toBe(luckPotions);
  });

  it("la récompense de découverte n'est donnée qu'à la première obtention", async () => {
    await rollExactly("phenix"); // Legendary → 1 potion de super chance + succès
    const first = store.stored(player.uid).potions.owned.superLuck;
    await rollExactly("phenix");
    await rollExactly("phenix");
    expect(store.stored(player.uid).potions.owned.superLuck).toBe(first);
    expect(store.stored(player.uid).inventory.phenix.count).toBe(3);
  });

  it("la potion de palier (tous les 100 rolls) n'est donnée qu'une fois par palier", async () => {
    for (let i = 0; i < 100; i++) {
      clock += 1_000;
      await call({ action: "roll", count: 1 });
    }
    const s = store.stored(player.uid);
    // 2 de départ + 1 (Premier roll) + 1 (palier 100) + 2 (Déjà-vu : 100× la même commune)
    expect(s.achievements.dupes_100).toBeDefined();
    expect(s.potions.owned.luck).toBe(6);
    clock += 1_000;
    await call({ action: "roll", count: 1 });
    expect(store.stored(player.uid).potions.owned.luck).toBe(6);
  });

  it("boire une potion la consomme : impossible de la réutiliser", async () => {
    await call({ action: "load" });
    expect(store.stored(player.uid).potions.owned.speed).toBe(1);
    await call({ action: "potion", potionId: "speed" });
    expect((await rejected(call({ action: "potion", potionId: "speed" })))?.code).toBe("failed-precondition");
    expect(store.stored(player.uid).potions.owned.speed).toBe(0);
  });
});

describe("requêtes concurrentes", () => {
  it("20 rolls simultanés ne dépassent pas le crédit et l'inventaire reste cohérent", async () => {
    const outcomes = await Promise.allSettled(Array.from({ length: 20 }, () => call({ action: "roll", count: MAX_ROLL_BATCH })));
    const granted = outcomes
      .filter((o): o is PromiseFulfilledResult<Awaited<ReturnType<typeof call>>> => o.status === "fulfilled")
      .reduce((n, o) => n + o.value.results!.length, 0);
    const s = store.stored(player.uid);
    expect(granted).toBe(MAX_ROLL_BATCH);
    expect(s.stats.rolls).toBe(MAX_ROLL_BATCH);
    expect(Object.values(s.inventory).reduce((n, e) => n + e.count, 0)).toBe(MAX_ROLL_BATCH);
    expect(store.retries).toBeGreaterThan(0); // les requêtes se sont bien entrelacées
  });

  it("10 potions bues en même temps avec une seule en stock : une seule réussit", async () => {
    await call({ action: "load" });
    const outcomes = await Promise.allSettled(Array.from({ length: 10 }, () => call({ action: "potion", potionId: "speed" })));
    expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
    const s = store.stored(player.uid);
    expect(s.potions.owned.speed).toBe(0);
    expect(s.stats.potionsUsed).toBe(1);
  });

  it("le succès Premier roll n'est récompensé qu'une fois malgré des rolls simultanés", async () => {
    await Promise.allSettled(Array.from({ length: 10 }, () => call({ action: "roll", count: 1 })));
    const s = store.stored(player.uid);
    // 2 de départ + 1 seul « Premier roll » (u = commune → pas de récompense de découverte)
    expect(s.potions.owned.luck).toBe(3);
  });
});

describe("isolation et données réelles", () => {
  it("un joueur ne peut ni lire ni modifier les données d'un autre", async () => {
    await call({ action: "roll", count: 1 });
    const other: Caller = { uid: "autre-uid", email: "autre@aurarng.local" };
    const res = await call({ action: "load", uid: player.uid, targetUid: player.uid }, other);
    expect(res.state.stats.rolls).toBe(0);
    expect(store.stored(player.uid).stats.rolls).toBe(1);
  });

  it("un joueur banni est refusé avant toute écriture", async () => {
    store.bans.set(player.uid, { until: clock + 60_000, reason: "test" });
    expect((await rejected(call({ action: "roll", count: 1 })))?.code).toBe("permission-denied");
    expect(store.raw(player.uid)).toBeUndefined();
  });

  it("des données stockées corrompues sont nettoyées à la lecture", () => {
    const s = normalizePlayerState(
      { inventory: { aura_inventee: { count: 5 }, phenix: { count: -3 } }, equipped: "aura_inventee", stats: { bestAuraId: "infini" } },
      "x",
      T0,
    );
    expect(s.inventory).toEqual({});
    expect(s.equipped).toBeNull();
    expect(s.stats.bestAuraId).toBeNull();
  });

  it("les règles RTDB interdisent toute écriture client sur les joueurs et le classement", () => {
    const rules = JSON.parse(readFileSync(new URL("../../database.rules.json", import.meta.url), "utf8")).rules;
    expect(rules[".write"]).toBe(false);
    expect(rules.v2[".write"]).toBeUndefined();
    expect(rules.v2.players.$uid[".write"]).toBeUndefined();
    expect(rules.v2.leaderboard[".write"]).toBeUndefined();
    expect(rules.v2.leaderboard.$uid).toBeUndefined();
    expect(rules.v2.players.$uid[".read"]).toBe("auth != null && auth.uid === $uid");
    expect(rules.v2.settings.$uid.$other[".validate"]).toBe(false);
  });

  it("la logique serveur testée n'importe aucun module Firebase", () => {
    const src = readFileSync(new URL("./handlers.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/from\s+["']firebase/);
  });

  it("les paliers de rareté du catalogue sont cohérents", () => {
    for (const a of AURAS) expect(getRarity(a.rarity).minOdds).toBeLessThanOrEqual(a.odds);
  });
});

describe("usurpation du nom affiché au classement", () => {
  const as = (c: Caller, data: unknown) =>
    handleApi(c, data, { store, rng: () => nextU, now: () => clock }).catch((e) => {
      throw toApiError(e);
    });

  it("ignore un displayName choisi par le joueur s'il ne correspond pas au compte", async () => {
    const spoof: Caller = { uid: "uid-mallory", email: "mallory@aurarng.local", displayName: "Alice" };
    const res = await as(spoof, { action: "load" });
    expect(res.state.name).toBe("mallory");
    expect(store.leaderboard.get("uid-mallory")?.name).toBe("mallory");
  });

  it("garde la casse choisie quand le displayName est bien le pseudo du compte", async () => {
    const res = await as({ uid: "u", email: "alice@aurarng.local", displayName: "ALICE" }, { action: "load" });
    expect(res.state.name).toBe("ALICE");
  });

  it("corrige un nom usurpé déjà enregistré et met à jour le classement", async () => {
    const mallory: Caller = { uid: "uid-mallory", email: "mallory@aurarng.local" };
    await as(mallory, { action: "load" });
    // simule une ancienne donnée corrompue (écrite avant le correctif)
    await store.updatePlayer("uid-mallory", (raw) => ({ ...normalizePlayerState(raw, "x", T0), name: "TopPlayer" }));
    const res = await as(mallory, { action: "roll", count: 1 });
    expect(res.state.name).toBe("mallory");
    expect(store.stored("uid-mallory").name).toBe("mallory");
    expect(store.leaderboard.get("uid-mallory")?.name).toBe("mallory");
  });

  it("ne permet pas d'enregistrer le pseudo d'un autre, même avec un displayName trafiqué", async () => {
    const spoof: Caller = { uid: "uid-mallory", email: "mallory@aurarng.local", displayName: "Alice" };
    expect((await rejected(as(spoof, { action: "register", name: "Alice" })))?.code).toBe("permission-denied");
    expect(store.usernames.get("alice")).toBeUndefined();
  });

  it("donne un nom générique aux comptes hors format pseudo@aurarng.local", async () => {
    for (const email of ["alice@gmail.com", "alice@aurarng.local.evil.com", undefined, "a@aurarng.local", "x".repeat(21) + "@aurarng.local"]) {
      const res = await as({ uid: `u-${email}`, email, displayName: "Alice" }, { action: "load" });
      expect(res.state.name, String(email)).toBe("Joueur");
    }
  });

  it("refuse les caractères spéciaux dans le displayName", async () => {
    const res = await as({ uid: "u", email: "alice@aurarng.local", displayName: "alice<script>" }, { action: "load" });
    expect(res.state.name).toBe("alice");
  });
});
