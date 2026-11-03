/**
 * Le rythme du jeu normal suit le temps de recharge du serveur : un joueur en auto-roll
 * n'est pas plus lent qu'un script ou que plusieurs onglets.
 */
import { describe, expect, it } from "vitest";
import { CHARGE_SHARE, MIN_BURST_MS, revealTiming } from "../game/revealTiming";

describe("rythme des rolls courants", () => {
  const cd = 288; // recharge la plus courte possible (horlogerie 10, agilité 5, potion de vitesse)
  const charge = Math.round(cd * CHARGE_SHARE);
  const opts = { reducedMotion: false, skipCommonReveal: false, auto: true, budgetMs: cd - charge };

  it("charge + affichage d'une aura courante tiennent dans la recharge", () => {
    for (const tier of [0, 1, 2]) {
      const { omenMs, burstMs } = revealTiming(tier, opts);
      expect(omenMs + charge + burstMs).toBeLessThanOrEqual(Math.max(cd, charge + MIN_BURST_MS));
    }
  });

  it("les auras rares gardent leur mise en scène complète", () => {
    expect(revealTiming(6, opts)).toEqual(revealTiming(6, { ...opts, budgetMs: undefined }));
  });

  it("sans auto ni passage rapide, l'affichage n'est pas raccourci", () => {
    const manual = { ...opts, auto: false };
    expect(revealTiming(0, manual)).toEqual(revealTiming(0, { ...manual, budgetMs: undefined }));
  });
});
