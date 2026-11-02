/**
 * Durées des découvertes, harmonisées sur les 15 raretés.
 * - L'intensité et la durée montent avec la rareté, mais la séquence complète
 *   (présage + révélation) reste courte, et le bouton ROLL (ou Échap, ou un clic)
 *   la passe à tout moment.
 * - « Réduire les animations » raccourcit tout ; les communes peuvent être instantanées.
 */
export interface RevealTiming {
  /** Présage (0 = pas de présage). */
  omenMs: number;
  /** Révélation (flash → particules → nom → badge → éclats). */
  burstMs: number;
}

/** Plafond de la révélation, pour les raretés les plus hautes. */
export const MAX_BURST_MS = 2_200;
export const MAX_OMEN_MS = 1_200;

export function revealTiming(tier: number, opts: { reducedMotion: boolean; skipCommonReveal: boolean; auto: boolean }): RevealTiming {
  const t = Math.max(0, tier);
  let omenMs = t >= 3 ? Math.min(MAX_OMEN_MS, 450 + (t - 3) * 70) : 0;
  let burstMs = Math.min(MAX_BURST_MS, 520 + t * 120);
  if (t <= 1 && (opts.skipCommonReveal || opts.auto)) burstMs = 380;
  if (opts.auto && t <= 2) omenMs = 0;
  if (opts.reducedMotion) {
    omenMs = omenMs ? 250 : 0;
    burstMs = Math.min(burstMs, 900);
  }
  return { omenMs, burstMs };
}
