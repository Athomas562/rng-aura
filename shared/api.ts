import type { PotionReward, RollResult } from "./engine";
import type { PotionId } from "./potions";
import type { QuestScope } from "./quests";
import type { RarityId } from "./rarities";
import type { PlayerState } from "./state";
import type { TalentId } from "./talents";

/** Requêtes acceptées par l'API. Le client n'envoie que des intentions ; le serveur valide tout. */
export type ApiRequest =
  | { action: "load" }
  | { action: "register"; name: string }
  | { action: "roll"; count: number }
  | { action: "potion"; potionId: PotionId; target?: RarityId }
  | { action: "equip"; auraId: string | null; slot?: number }
  | { action: "heartbeat" }
  | { action: "fuse"; auraId: string }
  | { action: "prestige" }
  | { action: "talent"; talentId: TalentId }
  | { action: "respec" }
  | { action: "title"; titleId: string | null }
  | { action: "mimic"; auraId: string | null }
  | { action: "claim"; scope: QuestScope | "mission"; id: string };

export interface ApiResponse {
  state: PlayerState;
  /** Horloge serveur, pour synchroniser les minuteurs côté client. */
  serverNow: number;
  results?: RollResult[];
  achievements?: string[];
  rewards?: PotionReward;
  /** Nouveau niveau atteint pendant l'action. */
  levelUp?: number;
  /** Aura obtenue par fusion. */
  fused?: { auraId: string; isNew: boolean; xp: number };
}

export type LeaderboardCategory = "rolls" | "bestOdds" | "collection" | "achievements" | "level" | "prestige" | "special";
export const LEADERBOARD_CATEGORIES: readonly LeaderboardCategory[] = [
  "rolls",
  "bestOdds",
  "collection",
  "achievements",
  "level",
  "prestige",
  "special",
];
export const LEADERBOARD_MAX = 50;

/** Ligne du classement renvoyée par l'API : sans uid, seulement le rang et un repère « moi ». */
export interface LeaderboardRow {
  rank: number;
  me: boolean;
  name: string;
  rolls: number;
  bestOdds: number;
  bestAuraId: string | null;
  collection: number;
  achievements: number;
  equipped: string | null;
  level: number;
  prestige: number;
  special: number;
  title: string | null;
}

export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
/** Les comptes existants utilisent pseudo@aurarng.local comme identifiant Firebase. */
export const EMAIL_DOMAIN = "@aurarng.local";

export function usernameToEmail(name: string): string {
  return name.toLowerCase() + EMAIL_DOMAIN;
}
