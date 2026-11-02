/**
 * Économie (Éclats, boutique) : gains, achats, plafonds et effets des améliorations.
 * Uniquement en mémoire.
 */
import { describe, expect, it } from "vitest";
import {
  BASE_ROLL_COOLDOWN_MS,
  GameError,
  POTIONS,
  POTION_PRICES,
  PRESTIGE_ROLLS,
  SHARD_CAP,
  SHARDS_BY_TIER,
  UPGRADES,
  blessedEvery,
  buyCosmetic,
  buyPotion,
  buyUpgrade,
  claimQuest,
  computeLuck,
  createPlayerState,
  dayKey,
  doPrestige,
  drinkPotion,
  equipAura,
  getRollCooldownMs,
  getUpgrade,
  normalizePlayerState,
  performRolls,
  questsFor,
  rollShards,
  slotCount,
  streakCap,
  wearCosmetic,
  type PlayerState,
} from "./index";

const T0 = 1_700_000_000_000;
const rich = (shards = 1_000_000) => {
  const s = createPlayerState("p", T0);
  s.shards = shards;
  return s;
};
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as GameError).code;
  }
  return null;
};

describe("gains d'Éclats", () => {
  it("un roll rapporte selon la rareté, la série, le roll béni et la découverte", () => {
    expect(rollShards("common", 1, false, false)).toBe(1);
    expect(rollShards("legendary", 1, false, false)).toBe(SHARDS_BY_TIER[4]);
    expect(rollShards("common", 120, false, false)).toBe(3); // +2 de série
    expect(rollShards("common", 1, true, false)).toBe(2);
    expect(rollShards("common", 1, false, true)).toBe(1 + 10);
  });

  it("performRolls crédite le solde, le total et l'historique, de façon cohérente avec les résultats", () => {
    const out = performRolls(createPlayerState("p", T0), T0, 4, () => 0.999999);
    const fromResults = out.results.reduce((s, r) => s + r.shards, 0);
    const achievementShards = out.shards - fromResults;
    expect(out.state.shards).toBe(out.shards);
    expect(out.state.stats.shardsEarned).toBe(out.shards);
    expect(achievementShards).toBeGreaterThan(0); // « Premier roll »
    expect(out.state.ledger.reduce((s, e) => s + e.amount, 0)).toBe(out.shards);
    expect(out.state.ledger[0].balance).toBe(out.state.shards);
  });

  it("quêtes, prestige et succès rapportent des éclats ; une seule fois", () => {
    let s = performRolls(createPlayerState("p", T0), T0, 1, () => 0.999999).state;
    const q = questsFor("daily", dayKey(T0))[0];
    s.quests.daily.counters[q.counter] = q.target;
    const before = s.shards;
    const claimed = claimQuest(s, "daily", q.id, T0);
    expect(claimed.state.shards).toBe(before + claimed.shards);
    expect(claimed.shards).toBeGreaterThanOrEqual(25);
    expect(code(() => claimQuest(claimed.state, "daily", q.id, T0))).toBe("invalid");

    s = createPlayerState("p", T0);
    s.stats.rolls = PRESTIGE_ROLLS;
    const p = doPrestige(s, T0);
    expect(p.shards).toBeGreaterThanOrEqual(500);
  });

  it("le solde ne dépasse jamais le plafond", () => {
    const s = rich(SHARD_CAP - 3);
    const out = performRolls(s, T0, 8, () => 0.999999);
    expect(out.state.shards).toBe(SHARD_CAP);
    expect(out.shards).toBe(3);
  });

  it("un solde falsifié dans les données stockées est nettoyé (négatif, décimal, énorme)", () => {
    expect(normalizePlayerState({ shards: -500 }, "x", T0).shards).toBe(0);
    expect(normalizePlayerState({ shards: 12.9 }, "x", T0).shards).toBe(12);
    expect(normalizePlayerState({ shards: 1e300 }, "x", T0).shards).toBe(SHARD_CAP);
    expect(normalizePlayerState({ shards: "9999" }, "x", T0).shards).toBe(0);
    expect(normalizePlayerState({ upgrades: { clover: 999, inconnu: 3 } }, "x", T0).upgrades.clover).toBe(20);
  });
});

describe("achats d'améliorations", () => {
  it("débite le coût exact et monte d'un niveau", () => {
    const s = rich(1_000);
    const cost = getUpgrade("clover").cost(0);
    const out = buyUpgrade(s, "clover", T0);
    expect(out.state.upgrades.clover).toBe(1);
    expect(out.state.shards).toBe(1_000 - cost);
    expect(out.state.stats.shardsSpent).toBe(cost);
    expect(out.state.ledger[0]).toMatchObject({ amount: -cost, balance: 1_000 - cost });
  });

  it("refuse un solde insuffisant sans rien modifier", () => {
    const s = rich(10);
    expect(code(() => buyUpgrade(s, "clover", T0))).toBe("funds");
    expect(s.shards).toBe(10);
    expect(s.upgrades.clover).toBe(0);
  });

  it("refuse au-delà du niveau maximal, le coût augmente à chaque niveau", () => {
    let s = rich();
    const u = getUpgrade("halo");
    for (let i = 0; i < u.maxLevel; i++) s = buyUpgrade(s, "halo", T0).state;
    expect(code(() => buyUpgrade(s, "halo", T0))).toBe("invalid");
    for (const up of UPGRADES) for (let l = 1; l < up.maxLevel; l++) expect(up.cost(l), up.id).toBeGreaterThanOrEqual(up.cost(l - 1));
  });

  it("les effets s'appliquent aux calculs serveur existants, dès le roll suivant", () => {
    let s = rich();
    for (let i = 0; i < 10; i++) s = buyUpgrade(s, "clockwork", T0).state;
    for (let i = 0; i < 5; i++) s = buyUpgrade(s, "clover", T0).state;
    for (let i = 0; i < 5; i++) s = buyUpgrade(s, "tenacity", T0).state;
    for (let i = 0; i < 2; i++) s = buyUpgrade(s, "halo", T0).state;
    for (let i = 0; i < 10; i++) s = buyUpgrade(s, "alembic", T0).state;
    expect(getRollCooldownMs(s, T0)).toBe(Math.round(BASE_ROLL_COOLDOWN_MS * 0.8));
    expect(computeLuck(s, T0, 1, 1).total).toBeCloseTo(1.1, 12);
    expect(streakCap(s)).toBeCloseTo(0.5, 12);
    expect(blessedEvery(s)).toBe(8);
    s.potions.owned.luck = 1;
    expect(drinkPotion(s, "luck", T0).state.potions.active.luck).toBe(T0 + POTIONS.luck.durationMs * 1.5);
    // au roll suivant, la chance du résultat inclut le Trèfle doré
    expect(performRolls(s, T0, 1, () => 0.999999).results[0].luck).toBeCloseTo(1.1, 12);
  });

  it("le roll béni ne descend jamais sous 1 sur 5, talents et Auréole compris", () => {
    const s = rich();
    s.upgrades.halo = 2;
    s.talents.benediction = 3;
    expect(blessedEvery(s)).toBe(5);
  });

  it("l'Écrin ajoute un emplacement d'aura utilisable", () => {
    let s = rich();
    expect(slotCount(s)).toBe(1);
    s = buyUpgrade(s, "slot", T0).state;
    expect(slotCount(s)).toBe(2);
    s.inventory.phenix = { count: 1, firstAt: T0, lastAt: T0, firstRoll: 0 };
    expect(equipAura(s, "phenix", 1).slots).toEqual(["phenix"]);
  });
});

describe("achats de potions et cosmétiques", () => {
  it("vend des potions à l'unité, quantité bornée et stock plafonné", () => {
    const s = rich(10_000);
    const out = buyPotion(s, "luck", 3, T0);
    expect(out.state.potions.owned.luck).toBe(s.potions.owned.luck + 3);
    expect(out.state.shards).toBe(10_000 - 3 * POTION_PRICES.luck);
    for (const q of [0, -1, 11, 1.5, Number.NaN]) expect(code(() => buyPotion(s, "luck", q, T0)), String(q)).toBe("invalid");
    const full = rich(1e6);
    full.potions.owned.luck = 95;
    expect(code(() => buyPotion(full, "luck", 5, T0))).toBe("invalid");
    expect(code(() => buyPotion(rich(10), "hourglass", 1, T0))).toBe("funds");
  });

  it("un cosmétique s'achète une fois, se porte et se retire ; impossible de porter un non-acheté", () => {
    const s = rich(10_000);
    expect(code(() => wearCosmetic(s, "trail", "trail_embers"))).toBe("not-owned");
    const out = buyCosmetic(s, "trail_embers", T0);
    expect(out.state.cosmetics.trail).toBe("trail_embers");
    expect(code(() => buyCosmetic(out.state, "trail_embers", T0))).toBe("invalid");
    expect(code(() => wearCosmetic(out.state, "frame", "trail_embers"))).toBe("invalid");
    expect(wearCosmetic(out.state, "trail", null).cosmetics.trail).toBeNull();
  });
});

describe("compatibilité", () => {
  it("une sauvegarde sans économie démarre à 0 éclat, sans amélioration", () => {
    const s: PlayerState = normalizePlayerState({ stats: { rolls: 10 } }, "x", T0);
    expect(s.shards).toBe(0);
    expect(Object.values(s.upgrades).every((l) => l === 0)).toBe(true);
    expect(s.cosmetics).toEqual({ owned: {}, trail: null, frame: null });
    expect(s.ledger).toEqual([]);
  });
});
