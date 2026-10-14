import { exportPKCS8, generateKeyPair, jwtVerify, type CryptoKey } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { DATABASE_SCOPES, GOOGLE_TOKEN_URL, createTokenProvider } from "./googleToken";

const EMAIL = "rng-aura-worker@rng-aura.iam.gserviceaccount.com";
let pem: string;
let publicKey: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  pem = await exportPKCS8(pair.privateKey);
  publicKey = pair.publicKey;
});

/** Faux serveur OAuth Google : vérifie l'assertion signée puis délivre un jeton. */
function fakeOAuth(expiresIn = 3600, now: () => number = Date.now) {
  const calls: URLSearchParams[] = [];
  const fetchImpl = async (url: string, init?: RequestInit) => {
    expect(url).toBe(GOOGLE_TOKEN_URL);
    const params = new URLSearchParams(String(init?.body));
    calls.push(params);
    const { payload } = await jwtVerify(params.get("assertion")!, publicKey, { audience: GOOGLE_TOKEN_URL, issuer: EMAIL, currentDate: new Date(now()) });
    expect(params.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
    expect(payload.scope).toBe(DATABASE_SCOPES);
    return new Response(JSON.stringify({ access_token: `jeton-${calls.length}`, expires_in: expiresIn }), { status: 200 });
  };
  return { fetchImpl, calls };
}

describe("jeton d'accès Google du compte de service", () => {
  it("signe une assertion valide limitée à la base et renvoie le jeton", async () => {
    const { fetchImpl, calls } = fakeOAuth();
    const get = createTokenProvider({ clientEmail: EMAIL, privateKey: pem }, fetchImpl);
    await expect(get()).resolves.toBe("jeton-1");
    expect(calls).toHaveLength(1);
  });

  it("met le jeton en cache puis le renouvelle avant expiration", async () => {
    let now = 1_000_000;
    const { fetchImpl, calls } = fakeOAuth(3600, () => now);
    const get = createTokenProvider({ clientEmail: EMAIL, privateKey: pem }, fetchImpl, () => now);
    await get();
    now += 30 * 60_000;
    await expect(get()).resolves.toBe("jeton-1");
    now += 26 * 60_000; // à moins de 5 min de l'expiration
    await expect(get()).resolves.toBe("jeton-2");
    expect(calls).toHaveLength(2);
  });

  it("ne fait qu'une demande pour des appels simultanés", async () => {
    const { fetchImpl, calls } = fakeOAuth();
    const get = createTokenProvider({ clientEmail: EMAIL, privateKey: pem }, fetchImpl);
    const tokens = await Promise.all(Array.from({ length: 10 }, get));
    expect(new Set(tokens)).toEqual(new Set(["jeton-1"]));
    expect(calls).toHaveLength(1);
  });

  it("accepte une clé collée avec des « \\n » littéraux (format JSON)", async () => {
    const { fetchImpl } = fakeOAuth();
    const get = createTokenProvider({ clientEmail: EMAIL, privateKey: pem.replace(/\n/g, "\\n") }, fetchImpl);
    await expect(get()).resolves.toBe("jeton-1");
  });

  it("échoue clairement si Google refuse, puis réessaie à l'appel suivant", async () => {
    let fail = true;
    const { fetchImpl } = fakeOAuth();
    const get = createTokenProvider({ clientEmail: EMAIL, privateKey: pem }, async (u, i) =>
      fail ? new Response("{}", { status: 400 }) : fetchImpl(u, i),
    );
    await expect(get()).rejects.toThrow(/HTTP 400/);
    fail = false;
    await expect(get()).resolves.toBe("jeton-1");
  });

  it("refuse une clé privée invalide", async () => {
    const get = createTokenProvider({ clientEmail: EMAIL, privateKey: "pas une clé" }, fakeOAuth().fetchImpl);
    await expect(get()).rejects.toThrow();
  });
});
