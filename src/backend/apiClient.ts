/**
 * Appel de l'API du Worker Cloudflare (`POST /api`) avec le jeton Firebase de l'utilisateur.
 * Les erreurs sont converties en `BackendError` exactement comme l'ancien `httpsCallable`.
 */
import type { ApiRequest, ApiResponse, LeaderboardCategory, LeaderboardRow } from "../../shared";
import { BackendError } from "./types";

export const API_URL = "/api";

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

interface ErrorBody {
  error?: { code?: unknown; message?: unknown; details?: { retryInMs?: unknown; until?: unknown } };
}

export function toBackendError(status: number, body: unknown): BackendError {
  const err = (body as ErrorBody | null)?.error;
  const code = typeof err?.code === "string" ? err.code : "";
  const message = typeof err?.message === "string" ? err.message : "Erreur inattendue.";
  const details = err?.details ?? {};
  const retryInMs = typeof details.retryInMs === "number" ? details.retryInMs : undefined;
  const until = typeof details.until === "number" ? details.until : undefined;

  switch (code) {
    case "resource-exhausted":
      return new BackendError("cooldown", message, { retryInMs });
    case "permission-denied":
      return until ? new BackendError("banned", message, { until }) : new BackendError("invalid", message);
    case "invalid-argument":
    case "failed-precondition":
    case "already-exists":
      return new BackendError("invalid", message);
    case "unauthenticated":
      return new BackendError("auth", "Session expirée, reconnecte-toi.");
    case "unavailable":
      return new BackendError("network", message);
  }
  if (status >= 500 || status === 0) return new BackendError("network", "Serveur injoignable.");
  return new BackendError("unknown", message);
}

export const LEADERBOARD_URL = "/api/leaderboard";

/** Classement servi par le Worker (D1). */
export async function fetchLeaderboard(
  category: LeaderboardCategory,
  limit: number,
  getIdToken: () => Promise<string>,
  fetchImpl: Fetch = fetch,
): Promise<LeaderboardRow[]> {
  const token = await getIdToken();
  const params = new URLSearchParams({ category, limit: String(limit) });
  let res: Response;
  try {
    res = await fetchImpl(`${LEADERBOARD_URL}?${params}`, { method: "GET", headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new BackendError("network", "Serveur injoignable.");
  }
  const body = (await res.json().catch(() => null)) as { data?: LeaderboardRow[] } | null;
  if (res.ok && Array.isArray(body?.data)) return body.data;
  throw toBackendError(res.status, body);
}

export async function callApi(req: ApiRequest, getIdToken: () => Promise<string>, fetchImpl: Fetch = fetch): Promise<ApiResponse> {
  const token = await getIdToken();
  let res: Response;
  try {
    res = await fetchImpl(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(req),
    });
  } catch {
    throw new BackendError("network", "Serveur injoignable.");
  }
  const body = (await res.json().catch(() => null)) as { data?: ApiResponse } | null;
  if (res.ok && body?.data) return body.data;
  throw toBackendError(res.status, body);
}
