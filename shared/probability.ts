import { AURAS, type Aura } from "./auras";

export interface DistributionEntry {
  aura: Aura;
  /** Probabilité exacte d'obtenir cette aura sur un roll. */
  p: number;
}

/**
 * Distribution exacte d'un roll pour une chance donnée.
 *
 * Règles :
 * 1. Les auras non-fallback sont servies de la plus rare à la plus commune.
 *    Chacune reçoit `min(luck / odds, probabilité restante)`.
 * 2. La probabilité restante est partagée entre les auras fallback,
 *    proportionnellement à `1 / odds`.
 *
 * La chance augmente donc la probabilité de chaque aura rare et « pousse »
 * les communes hors de la distribution quand elle devient très grande.
 * La somme vaut toujours exactement 1 (aux arrondis flottants près).
 */
export function computeDistribution(luck: number, auras: readonly Aura[] = AURAS): DistributionEntry[] {
  if (!Number.isFinite(luck) || luck <= 0) throw new Error(`Chance invalide : ${luck}`);

  const ranked = auras.filter((a) => !a.fallback).sort((a, b) => b.odds - a.odds);
  const fallbacks = auras.filter((a) => a.fallback);
  if (fallbacks.length === 0) throw new Error("Au moins une aura fallback est requise");

  const out: DistributionEntry[] = [];
  let remaining = 1;
  for (const aura of ranked) {
    const p = Math.min(luck / aura.odds, remaining);
    remaining -= p;
    out.push({ aura, p });
  }

  remaining = Math.max(0, remaining);
  const weightSum = fallbacks.reduce((s, a) => s + 1 / a.odds, 0);
  for (const aura of [...fallbacks].sort((a, b) => b.odds - a.odds)) {
    out.push({ aura, p: (remaining * (1 / aura.odds)) / weightSum });
  }
  return out;
}

/**
 * Tire une aura dans la distribution à partir d'un nombre uniforme `u` ∈ [0, 1).
 * Parcourt de la plus rare à la plus commune.
 */
export function pickFromDistribution(dist: readonly DistributionEntry[], u: number): Aura {
  if (!(u >= 0 && u < 1)) throw new Error(`Tirage hors [0,1) : ${u}`);
  let acc = 0;
  for (const entry of dist) {
    acc += entry.p;
    if (u < acc) return entry.aura;
  }
  // Arrondi flottant : on retombe sur la dernière aura ayant une probabilité non nulle.
  for (let i = dist.length - 1; i >= 0; i--) if (dist[i].p > 0) return dist[i].aura;
  return dist[dist.length - 1].aura;
}

/** Probabilité exacte d'une aura pour une chance donnée. */
export function probabilityOf(auraId: string, luck: number): number {
  return computeDistribution(luck).find((e) => e.aura.id === auraId)?.p ?? 0;
}

/** Formate une probabilité en « 1 sur N » lisible. */
export function formatOdds(p: number): string {
  if (p <= 0) return "—";
  const n = 1 / p;
  if (n < 10) return `1 sur ${n.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}`;
  return `1 sur ${Math.round(n).toLocaleString("fr-FR")}`;
}
