import type { PotionReward, RollResult } from "./engine";
import type { PotionId } from "./potions";
import type { PlayerState } from "./state";

/** Requêtes acceptées par la fonction `api`. Le client n'envoie que des intentions. */
export type ApiRequest =
  | { action: "load" }
  | { action: "register"; name: string }
  | { action: "roll"; count: number }
  | { action: "potion"; potionId: PotionId }
  | { action: "equip"; auraId: string | null }
  | { action: "heartbeat" };

export interface ApiResponse {
  state: PlayerState;
  /** Horloge serveur, pour synchroniser les minuteurs côté client. */
  serverNow: number;
  results?: RollResult[];
  achievements?: string[];
  rewards?: PotionReward;
}

export type LeaderboardCategory = "rolls" | "bestOdds" | "collection" | "achievements";
export const LEADERBOARD_CATEGORIES: readonly LeaderboardCategory[] = ["rolls", "bestOdds", "collection", "achievements"];
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
}

export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
/** Les comptes existants utilisent pseudo@aurarng.local comme identifiant Firebase. */
export const EMAIL_DOMAIN = "@aurarng.local";

export function usernameToEmail(name: string): string {
  return name.toLowerCase() + EMAIL_DOMAIN;
}
