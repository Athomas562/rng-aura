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
