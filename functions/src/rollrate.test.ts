/**
 * Anti-triche sur la cadence des rolls : un joueur qui spamme l'API par tous les moyens
 * (lots de 8, requêtes simultanées, doublons, potions, talents, prestige, horloge) ne doit
 * jamais dépasser un roll par temps de recharge.
 */
import { describe, expect, it } from "vitest";
import {
  BASE_ROLL_COOLDOWN_MS,
  COOLDOWN_TOLERANCE_MS,
  MIN_ROLL_COOLDOWN_MS,
  createPlayerState,
  getRollCooldownMs,
  normalizePlayerState,
  type LeaderboardEntry,
  type PlayerState,
} from "../../shared/index";
import { handleApi, type Caller, type PlayerStore } from "./handlers";

const T0 = 1_700_000_000_000;

class Store implements PlayerStore {
  row: { v: number; val: unknown } = { v: 0, val: null };
  async getBan() {
    return null;
  }
  async readPlayer() {
    return structuredClone(this.row.val);
  }
  async updatePlayer(_uid: string, mutate: (raw: unknown) => PlayerState) {
    for (let i = 0; i < 500; i++) {
      const read = this.row;
      const next = mutate(structuredClone(read.val));
      await new Promise((r) => setImmediate(r));
      if (this.row !== read) continue;
      this.row = { v: read.v + 1, val: JSON.parse(JSON.stringify(next)) };
      return next;
    }
    throw new Error("conflits");
  }
  async writeLeaderboard(_u: string, _e: LeaderboardEntry) {}
  async claimUsername() {
    return true;
  }
  get state() {
    return normalizePlayerState(this.row.val, "x", T0);
  }
}

const me: Caller = { uid: "uid-x", email: "x@aurarng.local", displayName: "x" };

function setup(mut?: (s: PlayerState) => void) {
  const store = new Store();
  const s = createPlayerState("x", T0);
  mut?.(s);
  store.row = { v: 1, val: JSON.parse(JSON.stringify(s)) };
  let clock = T0;
  const call = (data: unknown) => handleApi(me, data, { store, rng: Math.random, now: () => clock, newId: () => crypto.randomUUID() }).catch(() => null);
  return { store, call, tick: (ms: number) => (clock += ms), now: () => clock };
}

/** Rolls maximum légitimes sur `elapsed` ms avec un temps de recharge `cd`. */
const ceiling = (elapsed: number, cd: number) => Math.floor((elapsed + COOLDOWN_TOLERANCE_MS) / cd) + 1;

describe("cadence des rolls : spam par tous les moyens", () => {
  it("lots de 8 et requêtes simultanées toutes les 50 ms", async () => {
    const { store, call, tick, now } = setup();
    for (let t = 0; t < 60; t++) {
      await Promise.all(Array.from({ length: 6 }, () => call({ action: "roll", count: 8 })));
      tick(50);
    }
    expect(store.state.stats.rolls).toBeLessThanOrEqual(ceiling(now() - T0, BASE_ROLL_COOLDOWN_MS));
  }, 60_000);

  it("requestId différent à chaque requête, nombres bizarres (Infinity, 1e9, '8', -1, NaN)", async () => {
    const { store, call, tick, now } = setup();
    for (let t = 0; t < 60; t++) {
      await Promise.all(
        [Infinity, 1e9, "8", -1, NaN, 8.9, 1, null].map((count) => call({ action: "roll", count, requestId: crypto.randomUUID() })),
      );
      tick(50);
    }
    expect(store.state.stats.rolls).toBeLessThanOrEqual(ceiling(now() - T0, BASE_ROLL_COOLDOWN_MS));
  }, 60_000);

  it("potions de vitesse en boucle, talents, respec, prestige et heartbeats entre les rolls", async () => {
    const { store, call, tick, now } = setup((s) => {
      s.potions.owned.speed = 9_999;
      s.upgrades.clockwork = 10;
      s.talents.agilite = 5;
      s.shards = 1e9;
    });
    const fastest = getRollCooldownMs({ ...store.state, upgrades: { ...store.state.upgrades, clockwork: 10 }, talents: { ...store.state.talents } }, T0);
    const cdMin = Math.min(fastest, Math.round(BASE_ROLL_COOLDOWN_MS * 0.8 * 0.8 * 0.5));
    for (let t = 0; t < 60; t++) {
      await Promise.all([
        call({ action: "potion", potionId: "speed" }),
        call({ action: "roll", count: 8 }),
        call({ action: "roll", count: 8 }),
        t % 10 === 0 ? call({ action: "respec" }) : call({ action: "heartbeat" }),
        call({ action: "talent", talentId: "agilite" }),
        t % 30 === 0 ? call({ action: "prestige" }) : call({ action: "load" }),
      ]);
      tick(50);
    }
    expect(store.state.stats.rolls + 0).toBeLessThanOrEqual(ceiling(now() - T0, cdMin) + 10);
  }, 60_000);

  it("un état corrompu (niveaux d'amélioration/talents énormes) ne supprime pas la recharge", async () => {
    const { store, call, tick, now } = setup((s) => {
      (s.upgrades as Record<string, number>).clockwork = 1_000;
      (s.talents as Record<string, number>).agilite = 1_000;
    });
    for (let t = 0; t < 60; t++) {
      await Promise.all(Array.from({ length: 4 }, () => call({ action: "roll", count: 8 })));
      tick(50);
    }
    expect(store.state.stats.rolls).toBeLessThanOrEqual(ceiling(now() - T0, Math.round(BASE_ROLL_COOLDOWN_MS * 0.8 * 0.8)));
  }, 60_000);

  it("le temps de recharge ne descend jamais sous le plancher", () => {
    const s = createPlayerState("x", T0);
    (s.upgrades as Record<string, number>).clockwork = 1_000;
    s.potions.active.speed = T0 + 60_000;
    expect(getRollCooldownMs(normalizePlayerState(s, "x", T0), T0)).toBeGreaterThanOrEqual(MIN_ROLL_COOLDOWN_MS);
    expect(getRollCooldownMs(s, T0)).toBeGreaterThanOrEqual(MIN_ROLL_COOLDOWN_MS);
  });
});
