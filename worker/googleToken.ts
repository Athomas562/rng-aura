/**
 * Jeton d'accès OAuth 2.0 Google obtenu à partir d'un compte de service
 * (flux « JWT bearer »), limité à la Realtime Database.
 * La clé privée vient uniquement des secrets du Worker : elle n'est jamais envoyée au navigateur.
 */
import { SignJWT, importPKCS8 } from "jose";

export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const DATABASE_SCOPES = [
  "https://www.googleapis.com/auth/firebase.database",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export interface ServiceAccount {
  clientEmail: string;
  /** Clé PKCS#8 au format PEM. Les « \n » littéraux (copier-coller d'un JSON) sont acceptés. */
  privateKey: string;
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/** Renouvelle le jeton 5 minutes avant son expiration. */
const REFRESH_MARGIN_MS = 5 * 60_000;

export function createTokenProvider(account: ServiceAccount, fetchImpl: Fetch = fetch, now: () => number = Date.now) {
  let cached: { token: string; expiresAt: number } | null = null;
  let pending: Promise<string> | null = null;

  async function fetchToken(): Promise<string> {
    const pem = account.privateKey.replace(/\\n/g, "\n");
    const key = await importPKCS8(pem, "RS256");
    const iat = Math.floor(now() / 1000);
    const assertion = await new SignJWT({ scope: DATABASE_SCOPES })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuer(account.clientEmail)
      .setSubject(account.clientEmail)
      .setAudience(GOOGLE_TOKEN_URL)
      .setIssuedAt(iat)
      .setExpirationTime(iat + 3600)
      .sign(key);

    const res = await fetchImpl(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
    });
    if (!res.ok) throw new Error(`Jeton Google refusé (HTTP ${res.status})`);
    const body = (await res.json()) as { access_token?: unknown; expires_in?: unknown };
    if (typeof body.access_token !== "string" || typeof body.expires_in !== "number") {
      throw new Error("Réponse OAuth invalide");
    }
    cached = { token: body.access_token, expiresAt: now() + body.expires_in * 1000 };
    return body.access_token;
  }

  return async function getAccessToken(): Promise<string> {
    if (cached && cached.expiresAt - REFRESH_MARGIN_MS > now()) return cached.token;
    // Une seule demande à la fois, même si plusieurs requêtes arrivent en même temps.
    pending ??= fetchToken().finally(() => {
      pending = null;
    });
    return pending;
  };
}
