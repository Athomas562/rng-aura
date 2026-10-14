/**
 * Paliers de rareté. Une aura appartient au palier dont la plage
 * [minOdds, palier suivant) contient sa valeur « 1 sur N ».
 */
export type RarityId =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mythical"
  | "divine"
  | "celestial"
  | "transcendent"
  | "infinity";

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
}

export const RARITIES: readonly Rarity[] = [
  { id: "common", tier: 0, label: "Common", minOdds: 2, color: "#a3b1c6", revealMs: 650 },
  { id: "uncommon", tier: 1, label: "Uncommon", minOdds: 5, color: "#5ee6a0", revealMs: 850 },
  { id: "rare", tier: 2, label: "Rare", minOdds: 20, color: "#4cc3ff", revealMs: 1200 },
  { id: "epic", tier: 3, label: "Epic", minOdds: 100, color: "#b072ff", revealMs: 1800 },
  { id: "legendary", tier: 4, label: "Legendary", minOdds: 1_000, color: "#ffc94d", revealMs: 2800 },
  { id: "mythical", tier: 5, label: "Mythical", minOdds: 10_000, color: "#ff4d7e", revealMs: 3400 },
  { id: "divine", tier: 6, label: "Divine", minOdds: 100_000, color: "#fff2a8", revealMs: 4200 },
  { id: "celestial", tier: 7, label: "Celestial", minOdds: 1_000_000, color: "#7af5ff", revealMs: 5000 },
  { id: "transcendent", tier: 8, label: "Transcendent", minOdds: 10_000_000, color: "#e3a6ff", revealMs: 6000 },
  { id: "infinity", tier: 9, label: "Infinity", minOdds: 100_000_000, color: "#ffffff", revealMs: 7500 },
];

const BY_ID = new Map(RARITIES.map((r) => [r.id, r]));

export function getRarity(id: RarityId): Rarity {
  const r = BY_ID.get(id);
  if (!r) throw new Error(`Rareté inconnue : ${id}`);
  return r;
}

/** Palier correspondant à une valeur « 1 sur N ». */
export function rarityForOdds(odds: number): Rarity {
  let found = RARITIES[0];
  for (const r of RARITIES) if (odds >= r.minOdds) found = r;
  return found;
}
