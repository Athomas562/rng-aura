/**
 * Implémentation de `PlayerStore` sur l'API REST de la Realtime Database.
 *
 * Écritures atomiques : lecture avec `X-Firebase-ETag: true`, puis écriture conditionnelle
 * `if-match: <etag>`. Si quelqu'un a écrit entre-temps, la base répond 412 et on recommence
 * avec la nouvelle valeur — même sémantique que les transactions de firebase-admin.
 */
import type { LeaderboardEntry, PlayerState } from "../shared";
import type { Ban, PlayerStore } from "../functions/src/handlers";

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface RestStoreOptions {
  /** URL de la base, ex. https://rng-aura-default-rtdb.europe-west1.firebasedatabase.app */
  databaseUrl: string;
  getAccessToken: () => Promise<string>;
  fetch?: Fetch;
  /** Nombre maximal de tentatives d'une écriture conditionnelle. */
  maxAttempts?: number;
}

/** Données du nouveau jeu, isolées de celles de l'ancienne version (comme functions/src/index.ts). */
const ROOT = "v2";

export class DatabaseError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

/** Les clés RTDB ne peuvent contenir ni « . # $ [ ] / » ni caractères de contrôle. */
const SAFE_KEY = /^[^.#$[\]/\u0000-\u001f\u007f]{1,768}$/;

function key(k: string): string {
  if (!SAFE_KEY.test(k)) throw new DatabaseError(`Clé de base invalide : ${JSON.stringify(k)}`);
  return encodeURIComponent(k);
}

export function createRestStore(options: RestStoreOptions): PlayerStore {
  const base = options.databaseUrl.replace(/\/+$/, "");
  const doFetch = options.fetch ?? fetch;
  const maxAttempts = options.maxAttempts ?? 25;

  async function request(path: string, init: RequestInit & { headers?: Record<string, string> } = {}, query = "") {
    const token = await options.getAccessToken();
    return doFetch(`${base}/${path}.json${query}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    });
  }

  async function read(path: string): Promise<{ value: unknown; etag: string }> {
    const res = await request(path, { method: "GET", headers: { "X-Firebase-ETag": "true" } });
    if (!res.ok) throw new DatabaseError(`Lecture refusée (${path})`, res.status);
    const etag = res.headers.get("ETag");
    if (!etag) throw new DatabaseError(`ETag absent (${path})`);
    return { value: await res.json(), etag };
  }

  /** Écrit si la valeur n'a pas changé depuis `etag`. Renvoie false en cas de conflit (412). */
  async function writeIfUnchanged(path: string, value: unknown, etag: string): Promise<boolean> {
    const res = await request(
      path,
      { method: "PUT", headers: { "Content-Type": "application/json", "if-match": etag }, body: JSON.stringify(value) },
      "?print=silent",
    );
    if (res.status === 412) return false;
    if (!res.ok) throw new DatabaseError(`Écriture refusée (${path})`, res.status);
    return true;
  }

  /**
   * Lecture-modification-écriture atomique ; `mutate` peut lever pour annuler.
   * Sans `value`, la transaction se termine sans écrire.
   */
  async function transaction<T>(path: string, mutate: (current: unknown) => { value?: unknown; result: T } | null) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const { value, etag } = await read(path);
      const next = mutate(value);
      if (next === null) return null; // annulé sans écriture
      if (!("value" in next)) return next; // rien à écrire
      if (await writeIfUnchanged(path, next.value, etag)) return next;
    }
    throw new DatabaseError(`Trop de conflits d'écriture (${path})`);
  }

  return {
    async getBan(uid) {
      const res = await request(`bans/${key(uid)}`, { method: "GET" });
      if (!res.ok) throw new DatabaseError("Lecture des bannissements refusée", res.status);
      const ban = (await res.json()) as Ban | null;
      return ban && typeof ban.until === "number" ? ban : null;
    },

    async updatePlayer(uid, mutate) {
      const out = await transaction(`${ROOT}/players/${key(uid)}`, (current) => {
        const state: PlayerState = mutate(current); // les erreurs du moteur annulent la transaction
        return { value: state, result: state };
      });
      return out!.result;
    },

    async writeLeaderboard(uid, entry: LeaderboardEntry) {
      const res = await request(
        `${ROOT}/leaderboard/${key(uid)}`,
        { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry) },
        "?print=silent",
      );
      if (!res.ok) throw new DatabaseError("Écriture du classement refusée", res.status);
    },

    async claimUsername(lower, uid, now) {
      const out = await transaction(`usernames/${key(lower)}`, (current) => {
        const owner = (current as { uid?: unknown } | null)?.uid;
        if (current && owner !== uid) return null; // pris par un autre joueur : rien n'est écrit
        if (current) return { result: true }; // déjà à ce joueur : aucune écriture
        return { value: { uid, createdAt: now }, result: true };
      });
      return out?.result ?? false;
    },
  };
}
