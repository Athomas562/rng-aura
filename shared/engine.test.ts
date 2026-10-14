import { describe, expect, it } from "vitest";
import {
  ACHIEVEMENTS,
  AURAS,
  BASE_ROLL_COOLDOWN_MS,
  GameError,
  MAX_ROLL_BATCH,
  POTIONS,
  POTION_MAX_STACK_MS,
  computeDistribution,
  computeLuck,
  createPlayerState,
  drinkPotion,
  equipAura,
  getRarity,
  getRollCooldownMs,
  grantableRolls,
  heartbeat,
  normalizePlayerState,
  performRolls,
  pickFromDistribution,
  probabilityOf,
  rarityForOdds,
  secureRng,
  seededRng,
  toLeaderboardEntry,
  type PlayerState,
} from "./index";

const T0 = 1_700_000_000_000;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Enchaîne `n` rolls en respectant le temps de recharge. */
function rollMany(state: PlayerState, n: number, rng = seededRng(1), start = T0) {
  let s = state;
  let t = start;
  for (let i = 0; i < n; i++) {
    s = performRolls(s, t, 1, rng).state;
    t += getRollCooldownMs(s, t);
  }
  return { state: s, t };
}

describe("catalogue", () => {
  it("contient au moins 30 auras aux identifiants uniques", () => {
    expect(AURAS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(AURAS.map((a) => a.id)).size).toBe(AURAS.length);
  });

  it("range chaque aura dans le palier correspondant à ses chances", () => {
    for (const a of AURAS) expect(rarityForOdds(a.odds).id, a.id).toBe(a.rarity);
  });

  it("couvre les 10 paliers de rareté", () => {
    expect(new Set(AURAS.map((a) => a.rarity)).size).toBe(10);
  });

  it("ne marque comme fallback que des auras communes", () => {
    for (const a of AURAS.filter((x) => x.fallback)) expect(a.rarity).toBe("common");
  });
});

describe("distribution", () => {
  it.each([1, 1.5, 2, 5, 10, 100, 1e6, 1e9])("somme à 1 pour une chance de %d", (luck) => {
    const dist = computeDistribution(luck);
    expect(sum(dist.map((e) => e.p))).toBeCloseTo(1, 12);
    for (const e of dist) expect(e.p).toBeGreaterThanOrEqual(0);
  });

  it("donne exactement 1/odds aux auras non communes à chance 1", () => {
    for (const a of AURAS.filter((x) => !x.fallback)) expect(probabilityOf(a.id, 1)).toBeCloseTo(1 / a.odds, 15);
  });

  it("multiplie les chances rares par la chance", () => {
    expect(probabilityOf("infini", 3)).toBeCloseTo(3 / 100_000_000, 18);
    expect(probabilityOf("phenix", 2)).toBeCloseTo(2 / 1_500, 15);
  });

  it("réduit les communes quand la chance augmente", () => {
    expect(probabilityOf("lueur", 5)).toBeLessThan(probabilityOf("lueur", 1));
  });

  it("élimine les communes avec une chance énorme, en servant d'abord les plus rares", () => {
    const dist = computeDistribution(1e9);
    expect(probabilityOf("lueur", 1e9)).toBe(0);
    // ouroboros (1/250M) est saturé à 1, rien ne reste pour les autres
    expect(dist[0].aura.id).toBe("ouroboros");
    expect(dist[0].p).toBe(1);
  });

  it("refuse une chance invalide", () => {
    expect(() => computeDistribution(0)).toThrow();
    expect(() => computeDistribution(Number.NaN)).toThrow();
  });

  it("tire selon les bornes cumulées", () => {
    const dist = computeDistribution(1);
    expect(pickFromDistribution(dist, 0).id).toBe(dist[0].aura.id);
    expect(pickFromDistribution(dist, 0.999999999999).id).toBe(dist[dist.length - 1].aura.id);
    expect(() => pickFromDistribution(dist, 1)).toThrow();
  });

  it("respecte statistiquement les probabilités (200 000 tirages)", () => {
    const rng = seededRng(42);
    const dist = computeDistribution(1);
    const N = 200_000;
    const counts = new Map<string, number>();
    for (let i = 0; i < N; i++) {
      const a = pickFromDistribution(dist, rng());
      counts.set(a.id, (counts.get(a.id) ?? 0) + 1);
    }
    for (const { aura, p } of dist) {
      if (p * N < 200) continue; // trop rare pour un test statistique
      const observed = (counts.get(aura.id) ?? 0) / N;
      const sigma = Math.sqrt((p * (1 - p)) / N);
      expect(Math.abs(observed - p), aura.id).toBeLessThan(5 * sigma);
    }
  });

  it("produit avec le RNG sécurisé des valeurs dans [0,1)", () => {
    for (let i = 0; i < 10_000; i++) {
      const u = secureRng();
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
    }
  });
});

describe("chance", () => {
  const fresh = () => createPlayerState("test", T0);

  it("vaut 1 sans bonus", () => {
    expect(computeLuck(fresh(), T0, 1, 1).total).toBe(1);
  });

  it("double sur les rolls bénis (tous les 10)", () => {
    const l = computeLuck(fresh(), T0, 10, 1);
    expect(l.blessed).toBe(true);
    expect(l.total).toBe(2);
  });

  it("cumule potions additives puis multiplicateurs", () => {
    const s = fresh();
    s.potions.active = { luck: T0 + 1000, superLuck: T0 + 1000, hourglass: T0 + 1000 };
    // (1 + 1 + 4) × 2
    expect(computeLuck(s, T0, 1, 1).total).toBe(12);
    // béni : × 2 de plus
    expect(computeLuck(s, T0, 20, 1).total).toBe(24);
  });

  it("ignore les potions expirées", () => {
    const s = fresh();
    s.potions.active = { luck: T0 - 1 };
    expect(computeLuck(s, T0, 1, 1).total).toBe(1);
  });

  it("ajoute un bonus de série plafonné", () => {
    expect(computeLuck(fresh(), T0, 1, 25).total).toBeCloseTo(1.04);
    expect(computeLuck(fresh(), T0, 1, 10_000).total).toBeCloseTo(1.3);
  });
});

describe("rolls", () => {
  it("met à jour inventaire, stats, équipement et succès", () => {
    const out = performRolls(createPlayerState("p", T0), T0, 1, seededRng(7));
    expect(out.results).toHaveLength(1);
    const { auraId, isNew } = out.results[0];
    expect(isNew).toBe(true);
    expect(out.state.stats.rolls).toBe(1);
    expect(out.state.inventory[auraId].count).toBe(1);
    expect(out.state.equipped).toBe(auraId);
    expect(out.state.stats.bestAuraId).toBe(auraId);
    expect(out.achievements).toContain("first_roll");
    expect(out.state.recent[0].auraId).toBe(auraId);
  });

  it("ne modifie pas l'état d'entrée", () => {
    const s = createPlayerState("p", T0);
    performRolls(s, T0, 1, seededRng(7));
    expect(s.stats.rolls).toBe(0);
  });

  it("refuse un roll pendant la recharge", () => {
    const s = performRolls(createPlayerState("p", T0), T0, 1, seededRng(1)).state;
    // le crédit initial permet une rafale, on la vide d'abord
    const drained = performRolls(s, T0, MAX_ROLL_BATCH, seededRng(2)).state;
    expect(() => performRolls(drained, T0 + 10, 1, seededRng(3))).toThrow(GameError);
    try {
      performRolls(drained, T0 + 10, 1, seededRng(3));
    } catch (e) {
      expect((e as GameError).code).toBe("cooldown");
      expect((e as GameError).retryInMs).toBeGreaterThan(0);
    }
  });

  it("ne dépasse jamais le rythme d'un roll par recharge sur la durée", () => {
    let s = createPlayerState("p", T0);
    const rng = seededRng(5);
    let t = T0;
    const end = T0 + 60_000;
    // un client qui spamme toutes les 50 ms en demandant le maximum
    while (t < end) {
      try {
        s = performRolls(s, t, MAX_ROLL_BATCH, rng).state;
      } catch {
        /* recharge */
      }
      t += 50;
    }
    const maxAllowed = MAX_ROLL_BATCH + Math.ceil(60_000 / BASE_ROLL_COOLDOWN_MS) + 1;
    expect(s.stats.rolls).toBeLessThanOrEqual(maxAllowed);
    expect(s.stats.rolls).toBeGreaterThan(60_000 / BASE_ROLL_COOLDOWN_MS - 2);
  });

  it("accorde des rolls groupés pour l'auto-roll après attente", () => {
    const s = performRolls(createPlayerState("p", T0), T0, 1, seededRng(1)).state;
    const later = T0 + 20 * BASE_ROLL_COOLDOWN_MS;
    expect(grantableRolls(s, later, 4)).toBe(4);
    expect(grantableRolls(s, later, 100)).toBe(MAX_ROLL_BATCH);
  });

  it("l'élixir de célérité divise la recharge par 2", () => {
    const s = createPlayerState("p", T0);
    expect(getRollCooldownMs(s, T0)).toBe(BASE_ROLL_COOLDOWN_MS);
    const fast = drinkPotion(s, "speed", T0).state;
    expect(getRollCooldownMs(fast, T0)).toBe(BASE_ROLL_COOLDOWN_MS / 2);
  });

  it("enchaîne une série et la remet à zéro après une pause", () => {
    const { state, t } = rollMany(createPlayerState("p", T0), 30);
    expect(state.stats.streak).toBe(30);
    const after = performRolls(state, t + 60_000, 1, seededRng(9)).state;
    expect(after.stats.streak).toBe(1);
    expect(after.stats.maxStreak).toBe(30);
  });

  it("offre une potion tous les 100 rolls", () => {
    const start = createPlayerState("p", T0);
    const { state } = rollMany(start, 100);
    // +1 luck (palier 100) +1 luck (succès first_roll) + éventuelles récompenses de découverte
    expect(state.potions.owned.luck).toBeGreaterThanOrEqual(start.potions.owned.luck + 2);
    expect(state.achievements.rolls_100).toBeDefined();
  });

  it("garde la meilleure aura selon la rareté", () => {
    const s = createPlayerState("p", T0);
    s.inventory.phenix = { count: 1, firstAt: T0, lastAt: T0 };
    s.stats.bestAuraId = "phenix";
    const out = performRolls(s, T0, 1, () => 0.999999); // tire une commune
    expect(out.state.stats.bestAuraId).toBe("phenix");
  });

  it("donne une aura ultra-rare quand u tombe dans sa tranche", () => {
    const out = performRolls(createPlayerState("p", T0), T0, 1, () => 0);
    expect(out.results[0].auraId).toBe("ouroboros");
    expect(out.achievements).toContain("beyond");
    expect(out.achievements).toContain("first_legendary");
  });
});

describe("potions", () => {
  it("consomme la potion et l'active pour sa durée", () => {
    const s = createPlayerState("p", T0);
    const out = drinkPotion(s, "speed", T0);
    expect(out.state.potions.owned.speed).toBe(s.potions.owned.speed - 1);
    expect(out.state.potions.active.speed).toBe(T0 + POTIONS.speed.durationMs);
    // le succès « Alchimiste » rend une potion de chance
    expect(out.rewards).toEqual({ luck: 1 });
  });

  it("active une potion de chance pour sa durée", () => {
    const s = createPlayerState("p", T0);
    const out = drinkPotion(s, "luck", T0);
    expect(out.state.potions.active.luck).toBe(T0 + POTIONS.luck.durationMs);
    expect(out.achievements).toContain("potion_1");
  });

  it("prolonge une potion déjà active, dans la limite du plafond", () => {
    let s = createPlayerState("p", T0);
    s.potions.owned.luck = 50;
    for (let i = 0; i < 20; i++) s = drinkPotion(s, "luck", T0).state;
    expect(s.potions.active.luck).toBe(T0 + POTION_MAX_STACK_MS);
  });

  it("refuse sans stock", () => {
    const s = createPlayerState("p", T0);
    expect(() => drinkPotion(s, "hourglass", T0)).toThrow(/plus cette potion/);
  });
});

describe("équipement", () => {
  it("équipe uniquement une aura possédée", () => {
    const s = performRolls(createPlayerState("p", T0), T0, 1, seededRng(3)).state;
    const owned = Object.keys(s.inventory)[0];
    expect(equipAura(s, owned).equipped).toBe(owned);
    expect(equipAura(s, null).equipped).toBeNull();
    expect(() => equipAura(s, "infini")).toThrow(GameError);
  });
});

describe("temps de jeu", () => {
  it("compte les intervalles courts et ignore les longues absences", () => {
    let s = createPlayerState("p", T0);
    s = heartbeat(s, T0).state;
    s = heartbeat(s, T0 + 60_000).state;
    expect(s.stats.playTimeMs).toBe(60_000);
    s = heartbeat(s, T0 + 60_000 + 3_600_000).state;
    expect(s.stats.playTimeMs).toBe(60_000);
  });

  it("ignore un horodatage dans le passé", () => {
    let s = heartbeat(createPlayerState("p", T0), T0).state;
    s = heartbeat(s, T0 - 50_000).state;
    expect(s.stats.playTimeMs).toBe(0);
    expect(s.stats.lastActiveAt).toBe(T0);
  });
});

describe("succès", () => {
  it("ont des identifiants uniques et des objectifs positifs", () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    const s = createPlayerState("p", T0);
    for (const a of ACHIEVEMENTS) expect(a.progress(s)[1]).toBeGreaterThan(0);
  });

  it("incluent ceux demandés", () => {
    const names = ACHIEVEMENTS.map((a) => a.name);
    for (const n of ["Premier roll", "Première aura légendaire", "Collectionneur", "Au-delà du possible"])
      expect(names).toContain(n);
  });
});

describe("normalisation", () => {
  it("reconstruit un état complet depuis des données partielles", () => {
    const s = normalizePlayerState(
      {
        stats: { rolls: 5 },
        inventory: { lueur: { count: 2, firstAt: 1, lastAt: 2 }, inconnue: { count: 9 } },
        equipped: "inconnue",
        recent: [{ auraId: "lueur", at: 1, luck: 1 }],
      },
      "nom",
      T0,
    );
    expect(s.stats.rolls).toBe(5);
    expect(Object.keys(s.inventory)).toEqual(["lueur"]);
    expect(s.equipped).toBeNull();
    expect(s.potions.owned.speed).toBe(0);
    expect(s.recent).toHaveLength(1);
    expect(s.name).toBe("nom");
  });

  it("retourne un état neuf pour des données absentes", () => {
    expect(normalizePlayerState(null, "x", T0).stats.rolls).toBe(0);
  });
});

describe("classement", () => {
  it("dérive l'entrée de l'état", () => {
    const s = createPlayerState("p", T0);
    s.inventory.phenix = { count: 1, firstAt: T0, lastAt: T0 };
    s.stats.bestAuraId = "phenix";
    s.stats.rolls = 42;
    const e = toLeaderboardEntry(s, T0);
    expect(e).toMatchObject({ name: "p", rolls: 42, bestOdds: 1_500, collection: 1 });
    expect(getRarity("legendary").tier).toBe(4);
  });
});
