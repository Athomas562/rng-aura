/**
 * Point d'entrée HTTP de l'API : authentification, validation de la requête,
 * puis la même logique serveur que la Cloud Function (`handleApi`).
 */
import type { MarketStore } from "../functions/src/market";
import { LEADERBOARD_CATEGORIES, LEADERBOARD_MAX, secureRng, type LeaderboardCategory, type LeaderboardRow, type Rng } from "../shared";
import { ApiError, handleApi, toApiError, type ApiErrorCode, type PlayerStore } from "../functions/src/handlers";
import { AuthError, type VerifiedUser } from "./auth";

export const API_PATH = "/api";
export const LEADERBOARD_PATH = "/api/leaderboard";
/** Une requête légitime fait moins de 200 octets. */
export const MAX_BODY_BYTES = 8 * 1024;

export interface ApiDeps {
  verifyToken: (token: string) => Promise<VerifiedUser>;
  store: PlayerStore;
  rng?: Rng;
  now?: () => number;
  /** Journal structuré (rolls : roll_id, horodatage serveur, série avant/après). */
  log?: (entry: Record<string, unknown>) => void;
  /** Tables du marché (D1). */
  market?: MarketStore;
}

export type ErrorCode = ApiErrorCode | "unauthenticated" | "method-not-allowed" | "payload-too-large" | "unavailable" | "internal";

const STATUS: Record<ErrorCode, number> = {
  "invalid-argument": 400,
  unauthenticated: 401,
  "permission-denied": 403,
  "method-not-allowed": 405,
  "failed-precondition": 409,
  "already-exists": 409,
  "not-found": 404,
  "payload-too-large": 413,
  "resource-exhausted": 429,
  internal: 500,
  unavailable: 503,
};

const SECURITY_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export function errorResponse(code: ErrorCode, message: string, details?: Record<string, unknown>, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify({ error: { code, message, ...(details ? { details } : {}) } }), {
    status: STATUS[code],
    headers: { ...SECURITY_HEADERS, ...extra },
  });
}

function bearerToken(request: Request): string | null {
  const auth = request.headers.get("Authorization") ?? "";
  return /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(auth)?.[1] ?? null;
}

/** Vérifie le jeton Firebase ; renvoie l'utilisateur ou une réponse d'erreur prête à envoyer. */
async function authenticate(token: string, verify: ApiDeps["verifyToken"]): Promise<VerifiedUser | Response> {
  try {
    return await verify(token);
  } catch (e) {
    if (e instanceof AuthError) return errorResponse("unauthenticated", "Session invalide ou expirée, reconnecte-toi");
    console.error("vérification du jeton impossible", e);
    return errorResponse("unavailable", "Vérification de la session impossible, réessaie");
  }
}

export interface LeaderboardDeps {
  verifyToken: ApiDeps["verifyToken"];
  leaderboard: (category: LeaderboardCategory, limit: number, viewerUid: string) => Promise<LeaderboardRow[]>;
}

const DEVICE_RE = /^[A-Za-z0-9-]{8,64}$/;

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Empreintes anti-mule : IP (fournie par Cloudflare) et identifiant d'appareil (envoyé par le
 * navigateur), HACHÉES avant d'être stockées — l'IP en clair n'est jamais conservée.
 */
export async function hashFootprint(request: Request): Promise<{ ipHash?: string; deviceHash?: string }> {
  const ip = request.headers.get("CF-Connecting-IP") ?? "";
  const device = request.headers.get("X-Device-Id") ?? "";
  return {
    ...(ip ? { ipHash: await sha256(`rng-aura:ip:${ip}`) } : {}),
    ...(DEVICE_RE.test(device) ? { deviceHash: await sha256(`rng-aura:device:${device}`) } : {}),
  };
}

/** `GET /api/leaderboard?category=rolls&limit=50` : lecture seule, réservée aux joueurs connectés. */
export async function handleLeaderboardRequest(request: Request, deps: LeaderboardDeps): Promise<Response> {
  if (request.method !== "GET") {
    return errorResponse("method-not-allowed", "Méthode non autorisée", undefined, { Allow: "GET" });
  }
  const token = bearerToken(request);
  if (!token) return errorResponse("unauthenticated", "Connexion requise");
  const user = await authenticate(token, deps.verifyToken);
  if (user instanceof Response) return user;

  const params = new URL(request.url).searchParams;
  const category = params.get("category") ?? "rolls";
  if (!(LEADERBOARD_CATEGORIES as readonly string[]).includes(category)) {
    return errorResponse("invalid-argument", "Catégorie inconnue");
  }
  const limit = Number(params.get("limit") ?? LEADERBOARD_MAX);
  if (!Number.isInteger(limit) || limit < 1 || limit > LEADERBOARD_MAX) {
    return errorResponse("invalid-argument", `Limite entre 1 et ${LEADERBOARD_MAX}`);
  }

  try {
    const rows = await deps.leaderboard(category as LeaderboardCategory, limit, user.uid);
    return new Response(JSON.stringify({ data: rows }), { status: 200, headers: SECURITY_HEADERS });
  } catch (e) {
    console.error("erreur classement", e);
    return errorResponse("internal", "Erreur serveur");
  }
}

export async function handleApiRequest(request: Request, deps: ApiDeps): Promise<Response> {
  if (request.method !== "POST") {
    return errorResponse("method-not-allowed", "Méthode non autorisée", undefined, { Allow: "POST" });
  }
  if (!(request.headers.get("Content-Type") ?? "").toLowerCase().startsWith("application/json")) {
    return errorResponse("invalid-argument", "Corps JSON attendu");
  }

  const token = bearerToken(request);
  if (!token) return errorResponse("unauthenticated", "Connexion requise");

  const declared = Number(request.headers.get("Content-Length") ?? "0");
  if (declared > MAX_BODY_BYTES) return errorResponse("payload-too-large", "Requête trop volumineuse");
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return errorResponse("payload-too-large", "Requête trop volumineuse");

  const user = await authenticate(token, deps.verifyToken);
  if (user instanceof Response) return user;

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return errorResponse("invalid-argument", "JSON invalide");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return errorResponse("invalid-argument", "Requête invalide");
  }

  try {
    const footprint = await hashFootprint(request);
    const result = await handleApi(
      { uid: user.uid, email: user.email, displayName: user.name, ...footprint },
      data,
      { store: deps.store, rng: deps.rng ?? secureRng, now: deps.now ?? Date.now, log: deps.log, market: deps.market },
    );
    return new Response(JSON.stringify({ data: result }), { status: 200, headers: SECURITY_HEADERS });
  } catch (raw) {
    const e = toApiError(raw);
    if (e instanceof ApiError) return errorResponse(e.code, e.message, e.details);
    console.error("erreur API", e);
    return errorResponse("internal", "Erreur serveur");
  }
}
