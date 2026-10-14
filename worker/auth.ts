/**
 * Vérification des jetons d'identité Firebase (ID tokens) sans firebase-admin.
 * Reprend les contrôles documentés par Firebase : signature RS256 par une clé publique
 * de Google, émetteur et audience du projet, dates cohérentes, `sub` non vide.
 */
import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from "jose";

/** Clés publiques des jetons Firebase (format JWK), mises en cache par jose. */
export const FIREBASE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

export interface VerifiedUser {
  uid: string;
  email?: string;
  name?: string;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

let remoteKeys: JWTVerifyGetKey | null = null;
export function firebasePublicKeys(): JWTVerifyGetKey {
  remoteKeys ??= createRemoteJWKSet(new URL(FIREBASE_JWKS_URL));
  return remoteKeys;
}

export async function verifyFirebaseIdToken(
  token: string,
  projectId: string,
  keys: JWTVerifyGetKey = firebasePublicKeys(),
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<VerifiedUser> {
  try {
    const { payload } = await jwtVerify(token, keys, {
      algorithms: ["RS256"],
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      currentDate: new Date(nowSeconds * 1000),
      clockTolerance: 5,
      requiredClaims: ["sub", "iat", "exp", "auth_time"],
    });
    const { sub, iat, auth_time: authTime } = payload as { sub: string; iat: number; auth_time: unknown };
    if (typeof sub !== "string" || sub.length === 0 || sub.length > 128) throw new AuthError("Identifiant invalide");
    if (iat > nowSeconds + 5) throw new AuthError("Jeton émis dans le futur");
    if (typeof authTime !== "number" || authTime > nowSeconds + 5) throw new AuthError("Date d'authentification invalide");
    return {
      uid: sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
      name: typeof payload.name === "string" ? payload.name : undefined,
    };
  } catch (e) {
    if (e instanceof AuthError) throw e;
    if (e instanceof errors.JOSEError) throw new AuthError("Jeton invalide ou expiré");
    throw e;
  }
}
