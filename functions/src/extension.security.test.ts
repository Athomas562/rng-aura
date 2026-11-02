/**
 * Sécurité des nouvelles actions de l'API (fusion, prestige, talents, titres, quêtes,
 * emplacements, potions ciblées). Exécuté en mémoire, sans Firebase ni Cloudflare.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  PRESTIGE_ROLLS,
  createPlayerState,
  dayKey,
  normalizePlayerState,
  questsFor,
  type LeaderboardEntry,
  type PlayerState,
} from "../../shared/index";
import { handleApi, toApiError, type ApiError, type Caller, type PlayerStore } from "./handlers";

/** Store en mémoire avec transactions optimistes et pause aléatoire (requêtes entrelacées). */
class Store implements PlayerStore {
  players = new Map<string, { v: number; val: unknown }>();
  leaderboard = new Map<string, LeaderboardEntry>();

  async getBan() {
    return null;
  }

  async updatePlayer(uid: string, mutate: (raw: unknown) => PlayerState) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const read = this.players.get(uid) ?? { v: 0, val: null };
      const next = mutate(structuredClone(read.val));
      await new Promise((r) => setTimeout(r, Math.random() * 3));
      if ((this.players.get(uid)?.v ?? 0) !== read.v) continue;
      this.players.set(uid, { v: read.v + 1, val: JSON.parse(JSON.stringify(next)) });
      return next;
    }
    throw new Error("trop de conflits");
  }

  async writeLeaderboard(uid: string, entry: LeaderboardEntry) {
    this.leaderboard.set(uid, entry);
  }

  async claimUsername() {
    return true;
  }

  stored(uid: string): PlayerState {
    return normalizePlayerState(this.players.get(uid)?.val ?? null, "?", 0);
  }

  seed(uid: string, s: PlayerState) {
    this.players.set(uid, { v: 1, val: JSON.parse(JSON.stringify(s)) });
  }
}

const T0 = 1_700_000_000_000;
const player: Caller = { uid: "uid-x", email: "testeur@aurarng.local", displayName: "Testeur" };
let store: Store;

const call = (data: unknown) =>
  handleApi(player, data, { store, rng: () => 0.999999, now: () => T0 }).catch((e) => {
    throw toApiError(e);
  });
const rejected = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e as ApiError);

function seeded(mut: (s: PlayerState) => void) {
  const s = createPlayerState("testeur", T0);
  mut(s);
  store.seed(player.uid, s);
}

beforeEach(() => {
  store = new Store();
});

describe("validation des nouvelles actions", () => {
  it.each([
    [{ action: "fuse", auraId: 42 }],
    [{ action: "fuse", auraId: "n'existe-pas" }],
    [{ action: "talent", talentId: "triche" }],
    [{ action: "title", titleId: { $gt: "" } }],
    [{ action: "title", titleId: "x".repeat(500) }],
    [{ action: "mimic", auraId: ["phenix"] }],
    [{ action: "claim", scope: "daily", id: 7 }],
    [{ action: "claim", scope: "annual", id: "d_rolls_200" }],
    [{ action: "equip", auraId: "phenix", slot: "1" }],
    [{ action: "equip", auraId: "phenix", slot: 0.5 }],
    [{ action: "potion", potionId: "elixir_infini" }],
  ])("rejette %j avec invalid-argument", async (req) => {
    expect((await rejected(call(req)))?.code).toBe("invalid-argument");
  });

  it("refuse les intentions impossibles avec failed-precondition, sans rien écrire", async () => {
    await call({ action: "load" });
    const before = JSON.stringify(store.stored(player.uid));
    for (const req of [
      { action: "prestige" },
      { action: "fuse", auraId: "geyser" },
      { action: "talent", talentId: "fortune" },
      { action: "title", titleId: "ascendant" },
      { action: "mimic", auraId: null },
      { action: "claim", scope: "mission", id: "m_rolls" },
      { action: "equip", auraId: null, slot: 3 },
      { action: "potion", potionId: "focus", target: "legendary" },
    ]) {
      expect((await rejected(call(req)))?.code, JSON.stringify(req)).toBe("failed-precondition");
    }
    expect(JSON.stringify(store.stored(player.uid))).toBe(before);
  });
});

describe("double réclamation et requêtes simultanées", () => {
  it("10 réclamations simultanées d'une même quête : une seule récompense", async () => {
    const quest = questsFor("daily", dayKey(T0))[0];
    seeded((s) => {
      s.quests.daily = { key: dayKey(T0), counters: { [quest.counter]: quest.target }, claimed: {} };
    });
    const before = store.stored(player.uid).potions.owned;
    const results = await Promise.all(Array.from({ length: 10 }, () => rejected(call({ action: "claim", scope: "daily", id: quest.id }))));
    expect(results.filter((r) => r === null)).toHaveLength(1);
    const after = store.stored(player.uid);
    expect(after.stats.questsClaimed).toBe(1);
    for (const [id, n] of Object.entries(quest.reward)) {
      expect(after.potions.owned[id as keyof typeof before]).toBe(before[id as keyof typeof before] + n);
    }
  });

  it("10 fusions simultanées avec les ingrédients pour une seule : une seule réussit", async () => {
    seeded((s) => {
      s.inventory.phenix = { count: 2, firstAt: T0, lastAt: T0, firstRoll: 0 };
      s.inventory.abysse = { count: 2, firstAt: T0, lastAt: T0, firstRoll: 0 };
      s.codex.phenix = { firstAt: T0, total: 2 };
      s.codex.abysse = { firstAt: T0, total: 2 };
    });
    const results = await Promise.all(Array.from({ length: 10 }, () => rejected(call({ action: "fuse", auraId: "geyser" }))));
    expect(results.filter((r) => r === null)).toHaveLength(1);
    const s = store.stored(player.uid);
    expect(s.inventory.geyser.count).toBe(1);
    expect(s.inventory.phenix.count).toBe(1);
    expect(s.inventory.abysse.count).toBe(1);
  });

  it("5 prestiges simultanés : un seul, le suivant exige de nouveau 10 000 rolls", async () => {
    seeded((s) => {
      s.stats.rolls = PRESTIGE_ROLLS;
    });
    const results = await Promise.all(Array.from({ length: 5 }, () => rejected(call({ action: "prestige" }))));
    expect(results.filter((r) => r === null)).toHaveLength(1);
    expect(store.stored(player.uid).prestige.level).toBe(1);
  });

  it("dépenser plus de points de talent qu'on en a est impossible, même en parallèle", async () => {
    seeded((s) => {
      s.xp = 25 + 71; // niveau 3 : 2 points
    });
    await Promise.all(Array.from({ length: 6 }, () => rejected(call({ action: "talent", talentId: "fortune" }))));
    expect(store.stored(player.uid).talents.fortune).toBe(2);
  });
});

describe("classement", () => {
  it("publie niveau, prestige, auras spéciales et titre calculés par le serveur", async () => {
    seeded((s) => {
      s.stats.rolls = PRESTIGE_ROLLS;
      s.xp = 1e6;
    });
    await call({ action: "prestige" });
    await call({ action: "title", titleId: "ressuscite" });
    expect(store.leaderboard.get(player.uid)).toMatchObject({ prestige: 1, title: "ressuscite" });
    expect(store.leaderboard.get(player.uid)!.level).toBeGreaterThan(10);
  });
});

describe("boutique : anti-triche", () => {
  it.each([
    [{ action: "buy", kind: "upgrade", id: "infinite_luck" }],
    [{ action: "buy", kind: "potion", id: "luck", quantity: "5" }],
    [{ action: "buy", kind: "potion", id: "luck", quantity: 2.5 }],
    [{ action: "buy", kind: "cosmetic", id: { $ne: 1 } }],
    [{ action: "buy", kind: "shards", id: "x" }],
    [{ action: "wear", kind: "hat", id: null }],
    [{ action: "wear", kind: "trail", id: "trail_inconnu" }],
  ])("rejette %j avec invalid-argument", async (req) => {
    expect((await rejected(call(req)))?.code).toBe("invalid-argument");
  });

  it("ignore un solde, un prix ou un niveau envoyés par le client", async () => {
    seeded((s) => {
      s.shards = 100;
    });
    const res = await rejected(call({ action: "buy", kind: "upgrade", id: "clover", price: 1, shards: 1e9, level: 19 }));
    expect(res?.code).toBe("failed-precondition");
    expect(res?.details?.reason).toBe("funds");
    expect(store.stored(player.uid).shards).toBe(100);
    expect(store.stored(player.uid).upgrades.clover).toBe(0);
  });

  it("10 achats simultanés avec le solde pour un seul : un seul débit", async () => {
    seeded((s) => {
      s.shards = 200; // Trèfle doré niveau 1 = 200
    });
    const results = await Promise.all(Array.from({ length: 10 }, () => rejected(call({ action: "buy", kind: "upgrade", id: "clover" }))));
    expect(results.filter((r) => r === null)).toHaveLength(1);
    const s = store.stored(player.uid);
    expect(s.upgrades.clover).toBe(1);
    expect(s.shards).toBe(0);
    expect(s.stats.shardsSpent).toBe(200);
  });

  it("achats simultanés de potions : jamais de solde négatif", async () => {
    seeded((s) => {
      s.shards = 300; // 5 potions de chance à 60
    });
    await Promise.all(Array.from({ length: 12 }, () => rejected(call({ action: "buy", kind: "potion", id: "luck", quantity: 1 }))));
    const s = store.stored(player.uid);
    expect(s.shards).toBe(0);
    expect(s.potions.owned.luck).toBe(2 + 5);
  });

  it("un cosmétique acheté en parallèle n'est débité qu'une fois", async () => {
    seeded((s) => {
      s.shards = 10_000;
    });
    await Promise.all(Array.from({ length: 6 }, () => rejected(call({ action: "buy", kind: "cosmetic", id: "frame_gold" }))));
    expect(store.stored(player.uid).shards).toBe(8_000);
  });

  it("aucune action ne permet d'ajouter des éclats directement", async () => {
    await call({ action: "load" });
    for (const req of [{ action: "earn", amount: 1e6 }, { action: "shards", shards: 1e6 }, { action: "load", shards: 1e6 }]) {
      await rejected(call(req));
    }
    expect(store.stored(player.uid).shards).toBe(0);
  });

  it("le gain d'un roll est renvoyé au client et égal à la variation du solde", async () => {
    const res = await call({ action: "roll", count: 1 });
    expect(res.shards).toBe(store.stored(player.uid).shards);
    expect(res.results![0].shards).toBeGreaterThan(0);
  });
});

describe("prestige et classement", () => {
  it("la renaissance ne fait baisser aucune catégorie du classement", async () => {
    seeded((s) => {
      s.stats.rolls = PRESTIGE_ROLLS;
      s.xp = 50_000;
      s.shards = 9_999;
      s.upgrades.clover = 3;
      for (const id of ["phenix", "abysse", "mimique", "lueur"]) {
        s.inventory[id] = { count: 2, firstAt: T0, lastAt: T0, firstRoll: 0 };
        s.codex[id] = { firstAt: T0, total: 2 };
      }
      s.stats.bestAuraId = "mimique";
      s.equipped = "mimique";
    });
    await call({ action: "load" });
    const before = store.leaderboard.get(player.uid)!;
    await call({ action: "prestige" });
    const after = store.leaderboard.get(player.uid)!;
    for (const k of ["rolls", "bestOdds", "collection", "achievements", "level", "special"] as const) {
      expect(after[k], k).toBeGreaterThanOrEqual(before[k]);
    }
    expect(after.prestige).toBe(before.prestige + 1);
    expect(after.equipped).toBe("mimique");
    expect(after.bestAuraId).toBe("mimique");
  });
});
