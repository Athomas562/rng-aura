/**
 * Tests du moteur pour l'extension : nouvelles raretés, mécaniques spéciales,
 * niveau, talents, prestige, quêtes, nouvelles potions. Tout est exécuté en mémoire.
 */
import { describe, expect, it } from "vitest";
import {
  AURAS,
  BASE_ROLL_COOLDOWN_MS,
  GameError,
  MAX_ROLL_BATCH,
  PRESTIGE_ROLLS,
  POTIONS,
  claimMission,
  claimQuest,
  computeDistribution,
  computeLuck,
  createPlayerState,
  dayKey,
  doPrestige,
  drinkPotion,
  echoFormIndex,
  equipAura,
  fuseAura,
  getAura,
  getRollCooldownMs,
  learnTalent,
  levelInfo,
  livingStageIndex,
  lookOf,
  normalizePlayerState,
  performRolls,
  previewNextLuck,
  probabilityOf,
  questsFor,
  requireAura,
  resetTalents,
  rollableAuras,
  setMimic,
  setTitle,
  slotsFor,
  toLeaderboardEntry,
  xpToNext,
  type PlayerState,
} from "./index";

const T0 = 1_700_000_000_000; // 14 novembre 2023 : aucun événement en cours
const HALLOWEEN = Date.UTC(2026, 9, 31, 12);

const fresh = () => createPlayerState("p", T0);
/** Donne `count` exemplaires d'une aura (inventaire + codex). */
function give(s: PlayerState, id: string, count = 1) {
  s.inventory[id] = { count, firstAt: T0, lastAt: T0, firstRoll: s.stats.rolls };
  s.codex[id] = { firstAt: T0, total: count };
}
/** u qui tombe sur une aura donnée pour la chance du prochain roll. */
function uFor(s: PlayerState, now: number, auraId: string): number {
  const luck = previewNextLuck(s, now);
  let acc = 0;
  for (const { aura, p } of computeDistribution(luck.total, { now, focus: luck.focus })) {
    if (aura.id === auraId) return acc + p / 2;
    acc += p;
  }
  throw new Error(`${auraId} non tirable`);
}
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as GameError).code;
  }
  return null;
};

describe("saisons", () => {
  it("une aura saisonnière n'est tirable que pendant son événement", () => {
    expect(probabilityOf("citrouille", 1, { now: T0 })).toBe(0);
    expect(probabilityOf("citrouille", 1, { now: HALLOWEEN })).toBeCloseTo(1 / 666, 12);
    expect(rollableAuras(HALLOWEEN).some((a) => a.id === "citrouille")).toBe(true);
    expect(rollableAuras(HALLOWEEN).some((a) => a.id === "flocon_royal")).toBe(false);
  });

  it("l'événement en cours ajoute +10 % de chance, calculé avec l'horloge du serveur", () => {
    expect(computeLuck(fresh(), T0, 1, 1).total).toBe(1);
    expect(computeLuck(fresh(), HALLOWEEN, 1, 1).total).toBeCloseTo(1.1, 12);
  });

  it("un roll pendant l'événement peut donner l'aura exclusive", () => {
    const s = fresh();
    const out = performRolls(s, HALLOWEEN, 1, () => uFor(s, HALLOWEEN, "citrouille"));
    expect(out.results[0].auraId).toBe("citrouille");
    expect(out.achievements).toContain("special_seasonal");
  });
});

describe("fusion", () => {
  it("n'est jamais tirée en roll", () => {
    for (const a of AURAS.filter((x) => x.special?.kind === "fusion")) expect(probabilityOf(a.id, 1e9, { now: HALLOWEEN })).toBe(0);
  });

  it("refuse sans les ingrédients, en exigeant d'en garder un exemplaire", () => {
    const s = fresh();
    give(s, "phenix", 1);
    give(s, "abysse", 1);
    expect(code(() => fuseAura(s, "geyser", T0))).toBe("not-owned");
    give(s, "phenix", 2);
    give(s, "abysse", 2);
    const out = fuseAura(s, "geyser", T0);
    expect(out.state.inventory.phenix.count).toBe(1);
    expect(out.state.inventory.abysse.count).toBe(1);
    expect(out.state.inventory.geyser.count).toBe(1);
    expect(out.isNew).toBe(true);
    expect(out.state.stats.fusions).toBe(1);
    expect(out.achievements).toContain("fusion_1");
  });

  it("refuse de fusionner une aura qui n'est pas une fusion", () => {
    expect(code(() => fuseAura(fresh(), "phenix", T0))).toBe("invalid");
    expect(code(() => fuseAura(fresh(), "inexistante", T0))).toBe("invalid");
  });
});

describe("prestige", () => {
  const veteran = () => {
    const s = fresh();
    s.stats.rolls = PRESTIGE_ROLLS;
    give(s, "phenix", 3);
    give(s, "lueur", 50);
    s.equipped = "phenix";
    s.stats.bestAuraId = "phenix";
    return s;
  };

  it("est refusé avant 10 000 rolls depuis la dernière renaissance", () => {
    const s = veteran();
    s.stats.rolls = PRESTIGE_ROLLS - 1;
    expect(code(() => doPrestige(s, T0))).toBe("invalid");
  });

  it("garde les auras, remet à zéro éclats, améliorations et série, et donne +5 % de chance", () => {
    const s = veteran();
    s.xp = 5_000;
    s.shards = 12_345;
    s.upgrades.clover = 4;
    s.upgrades.slot = 1;
    s.stats.streak = 300;
    const before = s.potions.owned.hourglass;
    const out = doPrestige(s, T0);
    expect(out.state.prestige.level).toBe(1);
    expect(out.state.inventory.phenix.count).toBe(3);
    expect(out.state.inventory.lueur.count).toBe(50);
    expect(out.state.equipped).toBe("phenix");
    expect(Object.values(out.state.upgrades).every((l) => l === 0)).toBe(true);
    expect(out.state.stats.streak).toBe(0);
    // seul le bonus de renaissance (et des succès éventuels) reste dans le solde
    expect(out.state.shards).toBe(out.shards);
    expect(out.state.ledger.some((e) => e.amount === -12_345)).toBe(true);
    expect(out.state.codex.phenix).toBeDefined();
    expect(out.state.stats.bestAuraId).toBe("phenix");
    expect(out.state.xp).toBe(5_000);
    expect(out.rewards.hourglass).toBeGreaterThanOrEqual(1);
    expect(out.state.potions.owned.hourglass).toBe(before + out.rewards.hourglass!);
    expect(out.state.prestige.history[0]).toMatchObject({ level: 1, runRolls: PRESTIGE_ROLLS, bestAuraId: "phenix", collection: 2 });
    // +5 % de prestige ; le Trèfle doré (+8 %) a été remis à zéro
    expect(computeLuck(out.state, T0, 1, 1).total).toBeCloseTo(1.05, 12);
    expect(out.achievements).toContain("prestige_1");
  });

  it("exige de nouveau 10 000 rolls avant le prestige suivant, et plafonne à 10", () => {
    const after = doPrestige(veteran(), T0).state;
    expect(code(() => doPrestige(after, T0))).toBe("invalid");
    const max = fresh();
    max.prestige.level = 10;
    max.stats.rolls = 10 * PRESTIGE_ROLLS + PRESTIGE_ROLLS;
    expect(code(() => doPrestige(max, T0))).toBe("invalid");
  });

  it("ne redonne pas la récompense de découverte d'une aura déjà au codex", () => {
    const s = doPrestige(veteran(), T0).state;
    const superLuck = s.potions.owned.superLuck;
    const out = performRolls(s, T0, 1, () => uFor(s, T0, "phenix"));
    expect(out.results[0].isNew).toBe(false);
    expect(out.state.potions.owned.superLuck).toBe(superLuck);
    expect(out.state.inventory.phenix.count).toBe(4);
    expect(out.state.codex.phenix.total).toBe(4);
  });
});

describe("niveau et XP", () => {
  it("gagne de l'XP à chaque roll, ×10 à la première découverte", () => {
    const s = fresh();
    const first = performRolls(s, T0, 1, () => 0.999999);
    expect(first.results[0].isNew).toBe(true);
    expect(first.results[0].xp).toBe(10);
    const second = performRolls(first.state, T0 + 1000, 1, () => 0.999999);
    expect(second.results[0].xp).toBe(1);
  });

  it("calcule le niveau à partir de l'XP et signale la montée de niveau", () => {
    expect(levelInfo(0).level).toBe(1);
    expect(levelInfo(xpToNext(1)).level).toBe(2);
    const s = fresh();
    s.xp = xpToNext(1) - 5;
    const out = performRolls(s, T0, 1, () => 0.999999);
    expect(out.levelUp).toBe(2);
  });

  it("débloque des emplacements d'aura aux niveaux 10, 25 et 50", () => {
    expect([1, 10, 25, 50].map(slotsFor)).toEqual([1, 2, 3, 4]);
  });
});

describe("emplacements d'aura", () => {
  it("refuse un emplacement verrouillé ou une aura non possédée", () => {
    const s = fresh();
    give(s, "phenix");
    expect(code(() => equipAura(s, "phenix", 1))).toBe("invalid");
    expect(code(() => equipAura(s, "abysse", 0))).toBe("not-owned");
    expect(code(() => equipAura(s, "phenix", 1.5))).toBe("invalid");
  });

  it("équipe dans un emplacement débloqué, sans doublon avec l'aura principale", () => {
    const s = fresh();
    s.xp = 1e9; // niveau 100
    give(s, "phenix");
    give(s, "abysse");
    const a = equipAura(s, "phenix", 0);
    expect(code(() => equipAura(a, "phenix", 1))).toBe("invalid");
    const b = equipAura(a, "abysse", 2);
    expect(b.slots).toEqual([null, "abysse", null]);
    const c = equipAura(b, "abysse", 0);
    expect(c.equipped).toBe("abysse");
    expect(c.slots).toEqual([null, null, null]);
  });
});

describe("talents", () => {
  it("exige un point disponible, respecte le rang maximal et les prérequis", () => {
    const s = fresh();
    expect(code(() => learnTalent(s, "agilite"))).toBe("invalid"); // niveau 1 : 0 point
    s.xp = 1e9;
    expect(code(() => learnTalent(s, "endurance"))).toBe("invalid"); // nécessite Mains agiles 2
    let t = s;
    for (let i = 0; i < 5; i++) t = learnTalent(t, "agilite");
    expect(code(() => learnTalent(t, "agilite"))).toBe("invalid");
    expect(learnTalent(t, "endurance").talents.endurance).toBe(1);
  });

  it("les effets sont appliqués par le moteur (recharge, chance, roll béni) et la réinitialisation est gratuite", () => {
    const s = fresh();
    s.xp = 1e9;
    s.talents = { ...s.talents, agilite: 5, fortune: 5, benediction: 3 };
    expect(getRollCooldownMs(s, T0)).toBe(Math.round(BASE_ROLL_COOLDOWN_MS * 0.8));
    expect(computeLuck(s, T0, 1, 1).total).toBeCloseTo(1.15, 12);
    expect(computeLuck(s, T0, 7, 1).blessed).toBe(true);
    expect(Object.values(resetTalents(s).talents).every((r) => r === 0)).toBe(true);
  });

  it("un état falsifié avec des rangs impossibles est ramené au maximum", () => {
    const s = normalizePlayerState({ talents: { agilite: 99, fortune: -4, inconnu: 3 } }, "x", T0);
    expect(s.talents.agilite).toBe(5);
    expect(s.talents.fortune).toBe(0);
    expect((s.talents as Record<string, number>).inconnu).toBeUndefined();
  });
});

describe("titres et Mimique", () => {
  it("refuse un titre verrouillé ou inconnu", () => {
    const s = fresh();
    expect(setTitle(s, "novice").title).toBe("novice");
    expect(code(() => setTitle(s, "legende"))).toBe("invalid");
    expect(code(() => setTitle(s, "admin"))).toBe("invalid");
  });

  it("Mimique copie l'apparence d'une aura possédée", () => {
    const s = fresh();
    give(s, "phenix");
    expect(code(() => setMimic(s, "phenix"))).toBe("not-owned");
    give(s, "mimique");
    expect(code(() => setMimic(s, "abysse"))).toBe("not-owned");
    expect(code(() => setMimic(s, "mimique"))).toBe("invalid");
    const m = setMimic(s, "phenix");
    const look = lookOf(requireAura("mimique"), { rolls: 0, inventory: m.inventory, mimicOf: m.mimicOf });
    expect(look.visual).toEqual(requireAura("phenix").visual);
    expect(look.name).toContain("Phénix");
  });
});

describe("auras Écho et Vivante", () => {
  it("Écho change de forme tous les 100 rolls", () => {
    const echo = requireAura("echo_fractal");
    expect(echoFormIndex(echo, 99)).toBe(0);
    expect(echoFormIndex(echo, 100)).toBe(1);
    expect(lookOf(echo, { rolls: 0 }).name).not.toBe(lookOf(echo, { rolls: 100 }).name);
    // même objet d'un rendu à l'autre (pas de canvas recréé)
    expect(lookOf(echo, { rolls: 150 })).toBe(lookOf(echo, { rolls: 100 }));
  });

  it("Yggdrasil passe par 5 stades selon les rolls depuis son obtention", () => {
    const ygg = requireAura("yggdrasil");
    const inv = { yggdrasil: { firstRoll: 1_000 } };
    expect([1_000, 2_000, 6_000, 21_000, 51_000].map((rolls) => livingStageIndex(ygg, { rolls, inventory: inv }))).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("Marque maudite", () => {
  it("donne un bonus puis un malus, levé par l'Eau bénite", () => {
    const s = fresh();
    s.potions.owned.purify = 1;
    const out = performRolls(s, T0, 1, () => uFor(s, T0, "maudite"));
    expect(out.results[0].auraId).toBe("maudite");
    const st = out.state;
    expect(previewNextLuck(st, T0 + 1_000).total).toBeGreaterThan(3.9);
    expect(previewNextLuck(st, T0 + 100_000).total).toBeCloseTo(0.5, 12);
    expect(previewNextLuck(st, T0 + 200_000).total).toBe(1);
    const cleansed = drinkPotion(st, "purify", T0 + 100_000).state;
    expect(cleansed.curse).toBeNull();
    // plus de malédiction : une nouvelle Eau bénite est refusée sans être consommée
    expect(code(() => drinkPotion(cleansed, "purify", T0 + 100_000))).toBe("invalid");
  });

  it("l'Eau bénite est refusée sans malédiction (pas de consommation)", () => {
    const s = fresh();
    s.potions.owned.purify = 1;
    expect(code(() => drinkPotion(s, "purify", T0))).toBe("invalid");
  });
});

describe("nouvelles potions", () => {
  it("chance ciblée : exige une rareté valide et ne booste que celle-ci", () => {
    const s = fresh();
    s.potions.owned.focus = 2;
    expect(code(() => drinkPotion(s, "focus", T0))).toBe("invalid");
    expect(code(() => drinkPotion(s, "focus", T0, "common"))).toBe("invalid");
    expect(code(() => drinkPotion(s, "focus", T0, "n'importe quoi"))).toBe("invalid");
    const out = drinkPotion(s, "focus", T0, "legendary").state;
    const luck = previewNextLuck(out, T0);
    expect(luck.focus).toEqual({ rarity: "legendary", mul: 3 });
    const opts = { now: T0, focus: luck.focus };
    expect(probabilityOf("phenix", luck.total, opts)).toBeCloseTo(3 / 1_500, 12);
    expect(probabilityOf("chimere", luck.total, opts)).toBeCloseTo(1 / 15_000, 12);
    expect(out.potions.active.focus).toBe(T0 + POTIONS.focus.durationMs);
  });

  it("bénédiction garantie : le prochain roll est béni, une seule fois", () => {
    const s = fresh();
    const blessed = drinkPotion(s, "blessing", T0).state;
    expect(blessed.potions.pendingBlessings).toBe(1);
    const r1 = performRolls(blessed, T0, 1, () => 0.999999);
    expect(r1.results[0].blessed).toBe(true);
    expect(r1.state.potions.pendingBlessings).toBe(0);
    const r2 = performRolls(r1.state, T0 + 1_000, 1, () => 0.999999);
    expect(r2.results[0].blessed).toBe(false);
  });

  it("bénédiction garantie : pas plus de 5 en attente", () => {
    const s = fresh();
    s.potions.owned.blessing = 10;
    let t = s;
    for (let i = 0; i < 5; i++) t = drinkPotion(t, "blessing", T0).state;
    expect(code(() => drinkPotion(t, "blessing", T0))).toBe("invalid");
    expect(t.potions.owned.blessing).toBe(5);
  });

  it("potion de série : la série continue malgré une longue pause", () => {
    const s = fresh();
    s.potions.owned.streakGuard = 1;
    let st = performRolls(s, T0, 1, () => 0.999999).state;
    st = drinkPotion(st, "streakGuard", T0).state;
    st = performRolls(st, T0 + 120_000, 1, () => 0.999999).state;
    expect(st.stats.streak).toBe(2);
  });
});

describe("quêtes et missions", () => {
  it("3 quêtes par période, identiques pour tous, sans doublon", () => {
    const q = questsFor("daily", dayKey(T0));
    expect(q).toHaveLength(3);
    expect(new Set(q.map((x) => x.id)).size).toBe(3);
    expect(questsFor("daily", dayKey(T0)).map((x) => x.id)).toEqual(q.map((x) => x.id));
  });

  it("une quête terminée ne se réclame qu'une fois, une quête inachevée jamais", () => {
    let s = fresh();
    const quest = questsFor("daily", dayKey(T0))[0];
    expect(code(() => claimQuest(s, "daily", quest.id, T0))).toBe("invalid");
    s = performRolls(s, T0, 1, () => 0.999999).state;
    s.quests.daily.counters[quest.counter] = quest.target;
    const out = claimQuest(s, "daily", quest.id, T0);
    expect(out.state.stats.questsClaimed).toBe(1);
    expect(Object.keys(out.rewards).length).toBeGreaterThan(0);
    expect(code(() => claimQuest(out.state, "daily", quest.id, T0))).toBe("invalid");
  });

  it("refuse une quête qui n'est pas celle du jour", () => {
    const s = performRolls(fresh(), T0, 1, () => 0.999999).state;
    const today = new Set(questsFor("daily", dayKey(T0)).map((q) => q.id));
    const other = ["d_rolls_200", "d_rolls_500", "d_rare_5", "d_epic_1", "d_potions_2", "d_blessed_10", "d_streak_100", "d_xp_500"].find(
      (id) => !today.has(id),
    )!;
    s.quests.daily.counters = { rolls: 1e6, potions: 1e6, blessed: 1e6, "tier:rare": 1e6, "tier:epic": 1e6, streak: 1e6, xp: 1e6 };
    expect(code(() => claimQuest(s, "daily", other, T0))).toBe("invalid");
  });

  it("la progression repart de zéro le lendemain", () => {
    const s = performRolls(fresh(), T0, 1, () => 0.999999).state;
    expect(s.quests.daily.counters.rolls).toBe(1);
    const next = performRolls(s, T0 + 86_400_000, 1, () => 0.999999).state;
    expect(next.quests.daily.key).toBe(dayKey(T0 + 86_400_000));
    expect(next.quests.daily.counters.rolls).toBe(1);
  });

  it("les étapes de mission se réclament dans l'ordre, une fois chacune", () => {
    const s = fresh();
    s.stats.rolls = 12_000;
    expect(code(() => claimMission(s, "m_codex", T0))).toBe("invalid");
    const a = claimMission(s, "m_rolls", T0).state;
    const b = claimMission(a, "m_rolls", T0).state;
    expect(b.quests.missions.m_rolls).toBe(2);
    expect(code(() => claimMission(b, "m_rolls", T0))).toBe("invalid"); // 50 000 non atteint
    expect(code(() => claimMission(b, "m_inconnue", T0))).toBe("invalid");
  });
});

describe("classement et compatibilité", () => {
  it("l'entrée du classement inclut niveau, prestige, auras spéciales et titre", () => {
    const s = fresh();
    give(s, "mimique");
    give(s, "yggdrasil");
    s.prestige.level = 3;
    s.title = "novice";
    expect(toLeaderboardEntry(s, T0)).toMatchObject({ prestige: 3, special: 2, title: "novice", level: 1, collection: 2 });
  });

  it("une ancienne sauvegarde (sans codex ni nouveaux champs) reste valide", () => {
    const old = { name: "x", inventory: { phenix: { count: 2, firstAt: 5, lastAt: 6 } }, stats: { rolls: 40, bestAuraId: "phenix" }, potions: { owned: { luck: 3 } } };
    const s = normalizePlayerState(old, "x", T0);
    expect(s.codex.phenix).toEqual({ firstAt: 5, total: 2 });
    expect(s.stats.bestAuraId).toBe("phenix");
    expect(s.potions.owned.focus).toBe(0);
    expect(s.prestige.level).toBe(0);
    expect(s.quests.daily.key).toBe("");
    expect(performRolls(s, T0, MAX_ROLL_BATCH, () => 0.5).results.length).toBeGreaterThan(0);
  });

  it("toutes les auras ont un visuel complet et des identifiants valides", () => {
    for (const a of AURAS) {
      expect(a.visual.layers.length, a.id).toBeGreaterThan(0);
      expect(a.description.length, a.id).toBeGreaterThan(10);
      expect(getAura(a.id)).toBe(a);
      if (a.special?.kind === "fusion") for (const i of a.special.ingredients) expect(getAura(i.auraId), i.auraId).toBeDefined();
    }
  });
});
