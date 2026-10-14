/**
 * Worker Cloudflare de RNG Aura.
 *   POST /api              → actions du jeu (même logique serveur que l'ancienne Cloud Function)
 *   GET  /api/leaderboard  → classement
 *   tout le reste          → fichiers statiques (voir `run_worker_first` dans wrangler.jsonc)
 *
 * Données serveur : Cloudflare D1 (binding DB). Identité : jetons Firebase Authentication,
 * vérifiés avec les clés publiques de Google — aucun secret ni compte de service n'est nécessaire.
 */
import { verifyFirebaseIdToken } from "./auth";
import type { D1Database } from "./d1";
import { createD1Store } from "./d1Store";
import { API_PATH, LEADERBOARD_PATH, errorResponse, handleApiRequest, handleLeaderboardRequest } from "./http";

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB?: D1Database;
  FIREBASE_PROJECT_ID: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname !== API_PATH && pathname !== LEADERBOARD_PATH) return env.ASSETS.fetch(request);

    if (!env.DB || !env.FIREBASE_PROJECT_ID) return errorResponse("unavailable", "Serveur non configuré");

    const store = createD1Store(env.DB);
    const verifyToken = (token: string) => verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID);

    if (pathname === LEADERBOARD_PATH) return handleLeaderboardRequest(request, { verifyToken, leaderboard: store.leaderboard });
    return handleApiRequest(request, { verifyToken, store });
  },
};
