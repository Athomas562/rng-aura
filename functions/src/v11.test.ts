/**
 * v1.1 — Potion d'érudition, potions sans plafond, indices des succès secrets.
 * Moteur + vraie API serveur, en mémoire uniquement.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import {
  POTIONS,
  POTION_PRICES,
  PRESTIGE_REWARD,
  ROLL_MILESTONE_REWARDS,
  SECRET_ACHIEVEMENT_IDS,
  buyPotion,
  createPlayerState,
  drinkPotion,
  normalizePlayerState,
  performRolls,
  potionPrice,
  revealHint,
  xpMultiplier,
  type GameError,
  type LeaderboardEntry,
  type PlayerState,
} from "../../shared/index";
import { handleApi, toApiError, type ApiError, type Caller, type PlayerStore } from "./handlers";
import { hintTexts } from "./hints";

const T0 = 1_700_000_000_000;
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as GameError).code;
  }
  return null;
};

describe("potion d'érudition", () => {
  it("double l'XP pendant 5 minutes, puis plus rien", () => {
    const s = createPlayerState("p", T0);
    s.potions.owned.xpBoost = 1;
    const boosted = drinkPotion(s, "xpBoost", T0).state;
    expect(xpMultiplier(s, T0)).toBe(1);
    expect(xpMultiplier(boosted, T0 + 1_000)).toBe(2);
    expect(xpMultiplier(boosted, T0 + POTIONS.xpBoost.durationMs + 1)).toBe(1);
  });

  it("se multiplie avec le talent Érudit : ×2,2 au rang 1, ×3 au rang 5", () => {
    const s = createPlayerState("p", T0);
    s.potions.active.xpBoost = T0 + 60_000;
    s.talents.erudit = 1;
    expect(xpMultiplier(s, T0)).toBeCloseTo(2.2, 12);
    s.talents.erudit = 5;
    expect(xpMultiplier(s, T0)).toBeCloseTo(3, 12);
  });

  it("l'XP d'un roll réel est doublée (1 → 2, découverte 10 → 20)", () => {
    const s = createPlayerState("p", T0);
    s.potions.active.xpBoost = T0 + 60_000;
    const first = performRolls(s, T0, 1, () => 0.999999);
    expect(first.results[0].xp).toBe(20);
    const second = performRolls(first.state, T0 + 1_000, 1, () => 0.999999);
    expect(second.results[0].xp).toBe(2);
  });

  it("150 éclats l'unité, lot de 10 à 1 350, stock 99", () => {
    expect(POTION_PRICES.xpBoost).toBe(150);
    expect(potionPrice("xpBoost", 1)).toBe(150);
    expect(potionPrice("xpBoost", 3)).toBe(450);
    expect(potionPrice("xpBoost", 10)).toBe(1_350);
    const s = createPlayerState("p", T0);
    s.shards = 1_350;
    const out = buyPotion(s, "xpBoost", 10, T0);
    expect(out.state.shards).toBe(0);
    expect(out.state.potions.owned.xpBoost).toBe(10);
    s.potions.owned.xpBoost = 95;
    s.shards = 10_000;
    expect(code(() => buyPotion(s, "xpBoost", 5, T0))).toBe("invalid");
  });

  it("fait partie des sources existantes : paliers de rolls et renaissance", () => {
    expect(ROLL_MILESTONE_REWARDS.some((m) => m.potion === "xpBoost")).toBe(true);
    expect(PRESTIGE_REWARD.xpBoost).toBeGreaterThan(0);
  });
});

describe("potions sans plafond de durée", () => {
  it("99 potions de chance bues d'affilée = 495 minutes cumulées", () => {
    let s = createPlayerState("p", T0);
    s.potions.owned.luck = 99;
    for (let i = 0; i < 99; i++) s = drinkPotion(s, "luck", T0).state;
    expect(s.potions.active.luck).toBe(T0 + 99 * 5 * 60_000);
    expect(s.potions.owned.luck).toBe(1); // le succès « Alchimiste » (1re potion) en rend une
  });

  it("la puissance ne se cumule pas : la chance reste ×2 avec 99 potions", () => {
    let s = createPlayerState("p", T0);
    s.potions.owned.luck = 99;
    for (let i = 0; i < 99; i++) s = drinkPotion(s, "luck", T0).state;
    expect(performRolls(s, T0, 1, () => 0.999999).results[0].luck).toBe(2);
  });
});

describe("indices des succès secrets (moteur)", () => {
  const secret = SECRET_ACHIEVEMENT_IDS[0];

  it("chaque succès secret a 3 textes côté serveur", () => {
    expect(SECRET_ACHIEVEMENT_IDS.length).toBeGreaterThan(0);
    for (const id of SECRET_ACHIEVEMENT_IDS) expect(hintTexts()[id], id).toHaveLength(3);
  });

  it("niveau 1 gratuit, puis 50, puis 200 ; jamais de 4e niveau", () => {
    let s = createPlayerState("p", T0);
    s.shards = 250;
    s = revealHint(s, secret, T0).state;
    expect([s.hints[secret], s.shards]).toEqual([1, 250]);
    s = revealHint(s, secret, T0).state;
    expect([s.hints[secret], s.shards]).toEqual([2, 200]);
    s = revealHint(s, secret, T0).state;
    expect([s.hints[secret], s.shards]).toEqual([3, 0]);
    expect(code(() => revealHint(s, secret, T0))).toBe("invalid");
  });

  it("solde insuffisant refusé, succès non secret ou déjà débloqué refusé", () => {
    let s = createPlayerState("p", T0);
    s = revealHint(s, secret, T0).state;
    expect(code(() => revealHint(s, secret, T0))).toBe("funds");
    expect(code(() => revealHint(s, "first_roll", T0))).toBe("invalid");
    s.achievements[secret] = T0;
    s.shards = 1_000;
    expect(code(() => revealHint(s, secret, T0))).toBe("invalid");
  });

  it("des niveaux falsifiés sont nettoyés au chargement", () => {
    const s = normalizePlayerState({ hints: { [secret]: 99, first_roll: 2, inventé: 1 } }, "x", T0);
    expect(s.hints).toEqual({ [secret]: 3 });
  });
});

// ─────────────── API ───────────────

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

describe("indices des succès secrets (API)", () => {
  const player: Caller = { uid: "uid-h", email: "indice@aurarng.local", displayName: "Indice" };
  const secret = SECRET_ACHIEVEMENT_IDS[1];
  let store: Store;
  const call = (data: unknown) =>
    handleApi(player, data, { store, rng: () => 0.999999, now: () => T0 }).catch((e) => {
      throw toApiError(e);
    });

  beforeEach(() => {
    store = new Store();
  });

  it("le texte d'un indice n'est envoyé qu'une fois révélé", async () => {
    const before = await call({ action: "load" });
    expect(before.hints).toBeUndefined();
    expect(JSON.stringify(before)).not.toContain(hintTexts()[secret][0]);
    const after = await call({ action: "hint", achievementId: secret });
    expect(after.hints).toEqual({ [secret]: [hintTexts()[secret][0]] });
  });

  it("rejette un identifiant non secret ou mal formé", async () => {
    for (const id of ["first_roll", 42, { $ne: 1 }, "x".repeat(100)]) {
      const err = await call({ action: "hint", achievementId: id }).then(
        () => null,
        (e: ApiError) => e,
      );
      expect(err?.code, String(id)).toBe("invalid-argument");
    }
  });

  it("10 achats simultanés du niveau 2 : un seul débit de 50", async () => {
    await call({ action: "hint", achievementId: secret });
    const s = store.state;
    s.shards = 500;
    store.val = s;
    await Promise.all(Array.from({ length: 10 }, () => call({ action: "hint", achievementId: secret }).catch(() => null)));
    // niveaux 2 puis 3 au plus (50 + 200), jamais plus
    expect(store.state.hints[secret]).toBe(3);
    expect(store.state.shards).toBe(250);
  });
});

describe("les textes d'indices ne partent pas dans le site", () => {
  it("aucun fichier du client n'importe functions/src/hints (hors backend local de développement)", () => {
    const files: string[] = [];
    const walk = (dir: URL) => {
      for (const name of readdirSync(dir)) {
        const url = new URL(name, dir);
        if (statSync(url).isDirectory()) walk(new URL(`${name}/`, dir));
        else if (/\.tsx?$/.test(name)) files.push(url.pathname);
      }
    };
    walk(new URL("../../src/", import.meta.url));
    for (const f of files) {
      const src = readFileSync(decodeURIComponent(f.replace(/^\/([A-Za-z]:)/, "$1")), "utf8");
      expect(src, f).not.toMatch(/functions\/src\/hints/);
    }
  });
});

describe("le module des textes d'indices reste retirable du site", () => {
  it("n'exécute rien au chargement (seulement imports, déclarations et fonctions)", () => {
    const src = readFileSync(new URL("./hints.ts", import.meta.url), "utf8");
    const topLevel = src
      .split("\n")
      .filter((l) => /^\S/.test(l) && !/^(\/\*\*| \*|\*\/|\/\/|import |export function |let table|}|export type )/.test(l));
    expect(topLevel).toEqual([]);
  });
});
