/**
 * Arbre de talents. Un point par niveau gagné (plus 2 par prestige).
 * Chaque rang coûte 1 point ; certains talents demandent un rang minimum dans un autre.
 * Les effets sont lus par luck.ts et engine.ts, donc appliqués par le serveur.
 */
export type TalentId = "agilite" | "endurance" | "ferveur" | "fortune" | "benediction" | "erudit" | "alchimie";

export type TalentBranch = "vitesse" | "chance" | "savoir";

export interface Talent {
  id: TalentId;
  name: string;
  branch: TalentBranch;
  maxRank: number;
  /** Description d'un rang (ex. « −4 % de recharge »). */
  perRank: string;
  requires?: { talent: TalentId; rank: number };
}

export const TALENT_BRANCHES: { id: TalentBranch; name: string; color: string }[] = [
  { id: "vitesse", name: "Vitesse", color: "#4cc3ff" },
  { id: "chance", name: "Chance", color: "#5ee6a0" },
  { id: "savoir", name: "Savoir", color: "#b072ff" },
];

export const TALENTS: readonly Talent[] = [
  { id: "agilite", name: "Mains agiles", branch: "vitesse", maxRank: 5, perRank: "−4 % de temps de recharge" },
  { id: "endurance", name: "Endurance", branch: "vitesse", maxRank: 4, perRank: "+5 % au plafond du bonus de série", requires: { talent: "agilite", rank: 2 } },
  { id: "ferveur", name: "Ferveur", branch: "vitesse", maxRank: 3, perRank: "+10 s de délai avant que la série retombe", requires: { talent: "endurance", rank: 2 } },
  { id: "fortune", name: "Fortune", branch: "chance", maxRank: 5, perRank: "+3 % de chance permanente" },
  { id: "benediction", name: "Bénédiction", branch: "chance", maxRank: 3, perRank: "le roll béni arrive 1 roll plus tôt", requires: { talent: "fortune", rank: 3 } },
  { id: "erudit", name: "Érudit", branch: "savoir", maxRank: 5, perRank: "+10 % d'XP" },
  { id: "alchimie", name: "Alchimie", branch: "savoir", maxRank: 5, perRank: "+10 % de durée des potions", requires: { talent: "erudit", rank: 2 } },
];

export const TALENT_IDS = TALENTS.map((t) => t.id);

const BY_ID = new Map(TALENTS.map((t) => [t.id, t]));

export function getTalent(id: TalentId): Talent {
  const t = BY_ID.get(id);
  if (!t) throw new Error(`Talent inconnu : ${id}`);
  return t;
}

export function isTalentId(v: unknown): v is TalentId {
  return typeof v === "string" && BY_ID.has(v as TalentId);
}

export type TalentRanks = Record<TalentId, number>;

export function emptyTalents(): TalentRanks {
  return Object.fromEntries(TALENT_IDS.map((id) => [id, 0])) as TalentRanks;
}

export const spentTalentPoints = (t: TalentRanks): number => TALENT_IDS.reduce((s, id) => s + (t[id] ?? 0), 0);

// Effets (un seul endroit pour les valeurs, lu par la chance et le moteur)
export const talentCooldownMul = (t: TalentRanks) => 1 - 0.04 * (t.agilite ?? 0);
export const talentStreakCapBonus = (t: TalentRanks) => 0.05 * (t.endurance ?? 0);
export const talentStreakWindowMs = (t: TalentRanks) => 10_000 * (t.ferveur ?? 0);
export const talentLuckBonus = (t: TalentRanks) => 0.03 * (t.fortune ?? 0);
export const talentBlessedReduction = (t: TalentRanks) => t.benediction ?? 0;
export const talentXpMul = (t: TalentRanks) => 1 + 0.1 * (t.erudit ?? 0);
export const talentPotionDurationMul = (t: TalentRanks) => 1 + 0.1 * (t.alchimie ?? 0);
