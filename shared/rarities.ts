/**
 * Paliers de rareté.
 *
 * Les paliers « principaux » forment une échelle : une aura appartient au palier dont
 * la plage [minOdds, palier principal suivant) contient sa valeur « 1 sur N ».
 * Les paliers « branche » (Corrupted, Primordial, Dream) se superposent à l'échelle :
 * leurs auras ont des chances comprises entre leur minOdds et le palier principal suivant,
 * mais une apparence et une révélation propres.
 *
 * `tier` ordonne les paliers par prestige (0 = commun) : il sert aux récompenses,
 * aux effets visuels et aux succès.
 */
export type RarityId =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mythical"
  | "corrupted"
  | "divine"
  | "celestial"
  | "primordial"
  | "transcendent"
  | "dream"
  | "infinity"
  | "void"
  | "beyond";

export interface Rarity {
  id: RarityId;
  /** Index croissant avec la rareté (0 = commun). */
  tier: number;
  label: string;
  /** Plus petit « 1 sur N » accepté pour ce palier. */
  minOdds: number;
  color: string;
  /** Durée de base de l'animation de découverte, en ms. */
  revealMs: number;
  /** Palier hors échelle principale (voir plus haut). */
  branch?: boolean;
  /** Phrase affichée pendant le présage plein écran. */
  omen?: string;
}

export const RARITIES: readonly Rarity[] = [
  { id: "common", tier: 0, label: "Common", minOdds: 2, color: "#a3b1c6", revealMs: 650 },
  { id: "uncommon", tier: 1, label: "Uncommon", minOdds: 5, color: "#5ee6a0", revealMs: 850 },
  { id: "rare", tier: 2, label: "Rare", minOdds: 20, color: "#4cc3ff", revealMs: 1200 },
  { id: "epic", tier: 3, label: "Epic", minOdds: 100, color: "#b072ff", revealMs: 1800 },
  { id: "legendary", tier: 4, label: "Legendary", minOdds: 1_000, color: "#ffc94d", revealMs: 2800, omen: "Quelque chose approche…" },
  { id: "mythical", tier: 5, label: "Mythical", minOdds: 10_000, color: "#ff4d7e", revealMs: 3400, omen: "Quelque chose approche…" },
  { id: "corrupted", tier: 6, label: "Corrupted", minOdds: 50_000, color: "#39ff88", revealMs: 3800, branch: true, omen: "Err0r · d0nnées c0rr0mpues…" },
  { id: "divine", tier: 7, label: "Divine", minOdds: 100_000, color: "#fff2a8", revealMs: 4200, omen: "Le ciel se fend…" },
  { id: "celestial", tier: 8, label: "Celestial", minOdds: 1_000_000, color: "#7af5ff", revealMs: 5000, omen: "La réalité vacille…" },
  { id: "primordial", tier: 9, label: "Primordial", minOdds: 5_000_000, color: "#ff9d3d", revealMs: 5600, branch: true, omen: "Avant le commencement…" },
  { id: "transcendent", tier: 10, label: "Transcendent", minOdds: 10_000_000, color: "#e3a6ff", revealMs: 6000, omen: "La réalité vacille…" },
  { id: "dream", tier: 11, label: "Dream", minOdds: 20_000_000, color: "#ffb8f0", revealMs: 6500, branch: true, omen: "Tes paupières s'alourdissent…" },
  { id: "infinity", tier: 12, label: "Infinity", minOdds: 100_000_000, color: "#ffffff", revealMs: 7500, omen: "Le temps s'arrête…" },
  { id: "void", tier: 13, label: "Void", minOdds: 500_000_000, color: "#8c7bff", revealMs: 8000, omen: "Tout est aspiré…" },
  { id: "beyond", tier: 14, label: "Beyond", minOdds: 1_000_000_000, color: "#f4f4f4", revealMs: 9000, omen: "̷?̷?̷?̷ ̷i̷l̷l̷i̷s̷i̷b̷l̷e̷" },
];

const BY_ID = new Map(RARITIES.map((r) => [r.id, r]));

export function getRarity(id: RarityId): Rarity {
  const r = BY_ID.get(id);
  if (!r) throw new Error(`Rareté inconnue : ${id}`);
  return r;
}

export function isRarityId(v: unknown): v is RarityId {
  return typeof v === "string" && BY_ID.has(v as RarityId);
}

/** Palier de l'échelle principale correspondant à une valeur « 1 sur N ». */
export function rarityForOdds(odds: number): Rarity {
  let found = RARITIES[0];
  for (const r of RARITIES) if (!r.branch && odds >= r.minOdds) found = r;
  return found;
}

/** Plage [min, max) des chances acceptées pour un palier (max = palier principal suivant). */
export function oddsRange(id: RarityId): [number, number] {
  const r = getRarity(id);
  const next = RARITIES.find((x) => !x.branch && x.minOdds > r.minOdds);
  return [r.minOdds, next ? next.minOdds : Infinity];
}

/** Rang (tier) d'un palier, pour comparer sans coder de nombres en dur. */
export const tierOf = (id: RarityId): number => getRarity(id).tier;
