import type { ApiRequest, ApiResponse, LeaderboardCategory, LeaderboardRow } from "../../shared";
import type { Settings } from "../settings/settings";

export type { LeaderboardCategory, LeaderboardRow };

export interface AuthUser {
  uid: string;
  name: string;
}

export type BackendErrorCode =
  | "cooldown"
  | "banned"
  | "auth"
  | "invalid"
  | "network"
  | "unknown";

export class BackendError extends Error {
  constructor(
    public code: BackendErrorCode,
    message: string,
    public info: { retryInMs?: number; until?: number } = {},
  ) {
    super(message);
    this.name = "BackendError";
  }
}

/**
 * Tout ce dont le jeu a besoin pour persister et valider ses données.
 * Deux implémentations : Firebase (production) et locale (développement hors ligne).
 */
export interface GameBackend {
  readonly kind: "firebase" | "local";
  onAuthChange(cb: (user: AuthUser | null) => void): () => void;
  signIn(name: string, password: string): Promise<void>;
  register(name: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  call(req: ApiRequest): Promise<ApiResponse>;
  leaderboard(category: LeaderboardCategory, limit: number): Promise<LeaderboardRow[]>;
  loadSettings(uid: string): Promise<Partial<Settings> | null>;
  saveSettings(uid: string, settings: Settings): Promise<void>;
}
