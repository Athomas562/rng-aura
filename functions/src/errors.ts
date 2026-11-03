/** Erreurs renvoyées au client par l'API (code + message lisible + détails éventuels). */
export type ApiErrorCode =
  | "invalid-argument"
  | "permission-denied"
  | "resource-exhausted"
  | "failed-precondition"
  | "already-exists";

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}
