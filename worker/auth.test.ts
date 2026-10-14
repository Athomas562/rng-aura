import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type CryptoKey, type JWK } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { AuthError, verifyFirebaseIdToken } from "./auth";

const PROJECT = "rng-aura";
const NOW = 1_800_000_000;

let googleKey: CryptoKey;
let otherKey: CryptoKey;
let keys: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  const google = await generateKeyPair("RS256");
  const other = await generateKeyPair("RS256");
  googleKey = google.privateKey;
  otherKey = other.privateKey;
  const jwk: JWK = { ...(await exportJWK(google.publicKey)), kid: "google-1", alg: "RS256", use: "sig" };
  keys = createLocalJWKSet({ keys: [jwk] });
});

interface Claims {
  iss?: string;
  aud?: string;
  sub?: string;
  iat?: number;
  exp?: number;
  auth_time?: number;
  email?: string;
  name?: string;
}

async function token(claims: Claims = {}, opts: { key?: CryptoKey; kid?: string } = {}) {
  const c = {
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT,
    sub: "uid-alice",
    iat: NOW - 60,
    exp: NOW + 3000,
    auth_time: NOW - 120,
    email: "alice@aurarng.local",
    name: "Alice",
    ...claims,
  };
  const { iss, aud, sub, iat, exp, ...rest } = c;
  const jwt = new SignJWT(rest).setProtectedHeader({ alg: "RS256", kid: opts.kid ?? "google-1" }).setIssuedAt(iat).setExpirationTime(exp);
  if (iss) jwt.setIssuer(iss);
  if (aud) jwt.setAudience(aud);
  if (sub !== undefined) jwt.setSubject(sub);
  return jwt.sign(opts.key ?? googleKey);
}

const verify = (t: string) => verifyFirebaseIdToken(t, PROJECT, keys, NOW);
const rejects = (t: Promise<string>) => expect(t.then(verify)).rejects.toBeInstanceOf(AuthError);

describe("vérification des jetons Firebase", () => {
  it("accepte un jeton valide et renvoie uid, e-mail et nom", async () => {
    await expect(verify(await token())).resolves.toEqual({ uid: "uid-alice", email: "alice@aurarng.local", name: "Alice" });
  });

  it("refuse un jeton expiré", () => rejects(token({ exp: NOW - 10, iat: NOW - 3700 })));
  it("refuse un jeton d'un autre projet (audience)", () => rejects(token({ aud: "autre-projet" })));
  it("refuse un jeton d'un autre émetteur", () => rejects(token({ iss: "https://securetoken.google.com/autre-projet" })));
  it("refuse un jeton signé par une autre clé", () => rejects(token({}, { key: otherKey })));
  it("refuse une clé inconnue (kid)", () => rejects(token({}, { kid: "inconnue" })));
  it("refuse un jeton sans sujet", () => rejects(token({ sub: "" })));
  it("refuse un sujet trop long", () => rejects(token({ sub: "x".repeat(129) })));
  it("refuse un jeton émis dans le futur", () => rejects(token({ iat: NOW + 600 })));
  it("refuse une date d'authentification dans le futur", () => rejects(token({ auth_time: NOW + 600 })));

  it("refuse un jeton dont le contenu a été modifié", async () => {
    const [h, p, s] = (await token()).split(".");
    const payload = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
    payload.sub = "uid-admin";
    const forged = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    await expect(verify(`${h}.${forged}.${s}`)).rejects.toBeInstanceOf(AuthError);
  });

  it("refuse un jeton non signé (alg: none) ou HS256", async () => {
    const enc = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "");
    const body = enc({ iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, sub: "x", iat: NOW, exp: NOW + 60, auth_time: NOW });
    await expect(verify(`${enc({ alg: "none" })}.${body}.`)).rejects.toBeInstanceOf(AuthError);
    const hs = await new SignJWT({ auth_time: NOW })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(`https://securetoken.google.com/${PROJECT}`)
      .setAudience(PROJECT)
      .setSubject("x")
      .setIssuedAt(NOW)
      .setExpirationTime(NOW + 60)
      .sign(new TextEncoder().encode("secret-devine"));
    await expect(verify(hs)).rejects.toBeInstanceOf(AuthError);
  });

  it("refuse une chaîne qui n'est pas un JWT", async () => {
    await expect(verify("pas-un-jeton")).rejects.toBeInstanceOf(AuthError);
  });
});
