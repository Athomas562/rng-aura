import { describe, expect, it } from "vitest";
import { callApi, fetchLeaderboard, toBackendError } from "./apiClient";
import { BackendError } from "./types";

const ok = { state: { name: "Alice" }, serverNow: 1 };

describe("client de l'API", () => {
  it("envoie la requête en POST /api avec le jeton Bearer et renvoie data", async () => {
    let seen: { url: string; init?: RequestInit } | null = null;
    const res = await callApi({ action: "load" }, async () => "jeton", async (url, init) => {
      seen = { url, init };
      return new Response(JSON.stringify({ data: ok }), { status: 200 });
    });
    expect(res).toEqual(ok);
    expect(seen!.url).toBe("/api");
    expect(seen!.init?.method).toBe("POST");
    expect((seen!.init?.headers as Record<string, string>).Authorization).toBe("Bearer jeton");
    expect(JSON.parse(String(seen!.init?.body))).toEqual({ action: "load" });
  });

  it.each([
    [429, { code: "resource-exhausted", message: "Recharge", details: { retryInMs: 300 } }, "cooldown", { retryInMs: 300 }],
    [403, { code: "permission-denied", message: "Banni", details: { until: 99 } }, "banned", { until: 99 }],
    [403, { code: "permission-denied", message: "Non" }, "invalid", {}],
    [400, { code: "invalid-argument", message: "Bad" }, "invalid", {}],
    [409, { code: "failed-precondition", message: "Non possédée" }, "invalid", {}],
    [409, { code: "already-exists", message: "Pris" }, "invalid", {}],
    [401, { code: "unauthenticated", message: "x" }, "auth", {}],
    [503, { code: "unavailable", message: "Indispo" }, "network", {}],
    [502, null, "network", {}],
  ])("HTTP %i → BackendError", (status, error, code, info) => {
    const e = toBackendError(status, error ? { error } : null);
    expect(e).toBeInstanceOf(BackendError);
    expect(e.code).toBe(code);
    for (const [k, v] of Object.entries(info)) expect(e.info[k as "until"]).toBe(v);
  });

  it("lit le classement en GET /api/leaderboard avec le jeton et les paramètres", async () => {
    let seen: { url: string; init?: RequestInit } | null = null;
    const rows = [{ rank: 1, me: true, name: "Alice", rolls: 3, bestOdds: 7, bestAuraId: "brise", collection: 1, achievements: 1, equipped: null }];
    const res = await fetchLeaderboard("bestOdds", 50, async () => "jeton", async (url, init) => {
      seen = { url, init };
      return new Response(JSON.stringify({ data: rows }), { status: 200 });
    });
    expect(res).toEqual(rows);
    expect(seen!.url).toBe("/api/leaderboard?category=bestOdds&limit=50");
    expect(seen!.init?.method).toBe("GET");
    expect((seen!.init?.headers as Record<string, string>).Authorization).toBe("Bearer jeton");
  });

  it("convertit les erreurs du classement comme celles de l'API", async () => {
    const fail = (status: number, error: object) => async () => new Response(JSON.stringify({ error }), { status });
    await expect(fetchLeaderboard("rolls", 50, async () => "j", fail(401, { code: "unauthenticated", message: "x" }))).rejects.toMatchObject({ code: "auth" });
    await expect(fetchLeaderboard("rolls", 50, async () => "j", fail(503, { code: "unavailable", message: "x" }))).rejects.toMatchObject({ code: "network" });
  });

  it("signale une erreur réseau si le serveur est injoignable", async () => {
    await expect(callApi({ action: "load" }, async () => "j", async () => Promise.reject(new TypeError("fetch failed")))).rejects.toMatchObject({ code: "network" });
  });

  it("propage l'absence de session sans appeler le serveur", async () => {
    let called = false;
    await expect(
      callApi({ action: "load" }, async () => {
        throw new BackendError("auth", "Connexion requise.");
      }, async () => {
        called = true;
        return new Response("{}");
      }),
    ).rejects.toMatchObject({ code: "auth" });
    expect(called).toBe(false);
  });
});
