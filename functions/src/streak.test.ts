/**
 * P0 — non-régression de la série de rolls. Tout passe par la vraie API serveur (handleApi),
 * avec une horloge serveur simulée ; aucun horodatage client n'est utilisé.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { STREAK_WINDOW_MS, normalizePlayerState, type LeaderboardEntry, type PlayerState } from "../../shared/index";
import { handleApi, toApiError, type ApiError, type Caller, type PlayerStore } from "./handlers";

class Store implements PlayerStore {
  val: unknown = null;
  v = 0;
  async getBan() {
    return null;
  }
  async updatePlayer(_uid: string, mutate: (raw: unknown) => PlayerState) {
    for (let i = 0; i < 100; i++) {
      const v = this.v;
      const next = mutate(structuredClone(this.val));
      await new Promise((r) => setTimeout(r, Math.random() * 2));
      if (this.v !== v) continue;
      this.v++;
      this.val = JSON.parse(JSON.stringify(next));
      return next;
    }
    throw new Error("conflits");
  }
  async writeLeaderboard(_uid: string, _e: LeaderboardEntry) {}
  async claimUsername() {
    return true;
  }
  get state() {
    return normalizePlayerState(this.val, "?", 0);
  }
}

const T0 = 1_700_000_000_000;
const player: Caller = { uid: "uid-s", email: "serie@aurarng.local", displayName: "Serie" };
let store: Store;
let clock: number;
let logs: Record<string, unknown>[];

const call = (data: unknown) =>
  handleApi(player, data, { store, rng: () => 0.999999, now: () => clock, log: (e) => logs.push(e) }).catch((e) => {
    throw toApiError(e);
  });
const roll = (requestId?: string) => call({ action: "roll", count: 1, ...(requestId ? { requestId } : {}) });

beforeEach(() => {
  store = new Store();
  clock = T0;
  logs = [];
});

describe("série : horloge serveur et tolérance", () => {
  it("100 rolls espacés de 15 s → série de 100", async () => {
    for (let i = 0; i < 100; i++) {
      await roll();
      clock += 15_000;
    }
    expect(store.state.stats.streak).toBe(100);
    expect(store.state.stats.maxStreak).toBe(100);
  });

  it("tolère jusqu'à 25 s entre deux rolls (onglet ralenti par le navigateur)", async () => {
    expect(STREAK_WINDOW_MS).toBe(25_000);
    await roll();
    clock += 24_900;
    await roll();
    expect(store.state.stats.streak).toBe(2);
  });

  it("onglet gelé 2 min puis 10 rolls rapides : la série repart de 1 et monte normalement", async () => {
    for (let i = 0; i < 5; i++) {
      await roll();
      clock += 1_000;
    }
    expect(store.state.stats.streak).toBe(5);
    clock += 120_000;
    const streaks: number[] = [];
    for (let i = 0; i < 10; i++) {
      await roll();
      streaks.push(store.state.stats.streak);
      clock += 1_000;
    }
    expect(streaks).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(store.state.stats.maxStreak).toBe(10);
  });

  it("ignore tout horodatage ou série envoyés par le client", async () => {
    await roll();
    clock += 60_000;
    await call({ action: "roll", count: 1, now: clock - 1_000, lastRollAt: clock, streak: 999 });
    expect(store.state.stats.streak).toBe(1);
  });
});

describe("série : potion de série (gel)", () => {
  async function withGuard() {
    await roll();
    const s = store.state;
    s.potions.owned.streakGuard = 1;
    store.val = s;
    await call({ action: "potion", potionId: "streakGuard" });
    return store.state.potions.active.streakGuard!;
  }

  it("gèle la série pendant la potion, même après une longue pause", async () => {
    const end = await withGuard();
    clock = end - 1_000; // ~9 min de pause
    await roll();
    expect(store.state.stats.streak).toBe(2);
  });

  it("ne remet pas la série à zéro à l'expiration : la fenêtre repart de la fin de la potion", async () => {
    const end = await withGuard();
    clock = end + 20_000; // potion expirée depuis 20 s, aucun roll pendant la potion
    await roll();
    expect(store.state.stats.streak).toBe(2);
  });

  it("au-delà de 25 s après l'expiration, la série repart normalement de 1", async () => {
    const end = await withGuard();
    clock = end + 26_000;
    await roll();
    expect(store.state.stats.streak).toBe(1);
  });
});

describe("série : resets involontaires", () => {
  it("la renaissance ne remet pas la série à zéro", async () => {
    for (let i = 0; i < 3; i++) {
      await roll();
      clock += 1_000;
    }
    const s = store.state;
    s.stats.rolls = 10_000;
    store.val = s;
    await call({ action: "prestige" });
    await roll();
    expect(store.state.stats.streak).toBe(4);
  });

  it("obtenir la Marque maudite ne touche pas la série", async () => {
    for (let i = 0; i < 3; i++) {
      await roll();
      clock += 1_000;
    }
    const s = store.state;
    s.curse = { boonUntil: clock + 90_000, baneUntil: clock + 150_000, luck: 3, mul: 0.5 };
    store.val = s;
    await roll();
    expect(store.state.stats.streak).toBe(4);
  });
});

describe("idempotence et ordre des réponses", () => {
  it("une requête de roll renvoyée deux fois n'est traitée qu'une fois", async () => {
    const id = "1b4e28ba-2fa1-11d2-883f-0016d3cca427";
    const a = await roll(id);
    clock += 5_000;
    const b = await roll(id);
    expect(a.results).toHaveLength(1);
    expect(b.results).toEqual([]);
    expect(b.duplicate).toBe(true);
    expect(store.state.stats.rolls).toBe(1);
    expect(store.state.stats.streak).toBe(1);
  });

  it("10 envois simultanés de la même requête : un seul roll", async () => {
    clock += 60_000;
    const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    await Promise.all(Array.from({ length: 10 }, () => roll(id).catch(() => null)));
    expect(store.state.stats.rolls).toBe(1);
  });

  it("refuse un identifiant de requête mal formé", async () => {
    const err = await roll("<script>").then(
      () => null,
      (e: ApiError) => e,
    );
    expect(err?.code).toBe("invalid-argument");
  });

  it("chaque écriture augmente la révision : le client peut ignorer une réponse plus ancienne", async () => {
    const a = await roll();
    clock += 1_000;
    const b = await call({ action: "heartbeat" });
    clock += 1_000;
    const c = await roll();
    expect([a.state.rev, b.state.rev, c.state.rev]).toEqual([1, 2, 3]);
  });
});

describe("journal serveur", () => {
  it("chaque roll écrit {roll_id, horodatage serveur, série avant/après}", async () => {
    await roll("12345678-aaaa-bbbb-cccc-000000000001");
    clock += 1_000;
    await roll("12345678-aaaa-bbbb-cccc-000000000002");
    expect(logs).toHaveLength(2);
    expect(logs[1]).toMatchObject({
      event: "roll",
      roll_id: "12345678-aaaa-bbbb-cccc-000000000002",
      server_ts: T0 + 1_000,
      streak_before: 1,
      streak_after: 2,
    });
  });
});
