/**
 * Logique serveur de l'API, indépendante de Firebase (testable avec un store en mémoire).
 * Toute décision qui touche aux récompenses (rolls, potions, succès, classement)
 * est prise ici, à partir de l'état stocké — jamais à partir de ce qu'envoie le client.
 */
import {
  GameError,
  createPlayerState,
  drinkPotion,
  equipAura,
  getAura,
  heartbeat,
  isPotionId,
  normalizePlayerState,
  performRolls,
  toLeaderboardEntry,
  EMAIL_DOMAIN,
  USERNAME_RE,
  type ApiResponse,
  type LeaderboardEntry,
  type PlayerState,
  type Rng,
} from "../../shared/index";

export interface Ban {
  until: number;
  reason?: string;
}

export interface PlayerStore {
  getBan(uid: string): Promise<Ban | null>;
  /**
   * Applique `mutate` de façon atomique sur l'état stocké (brut, éventuellement absent).
   * `mutate` peut lever une erreur : l'écriture est alors annulée et l'erreur propagée.
   */
  updatePlayer(uid: string, mutate: (raw: unknown) => PlayerState): Promise<PlayerState>;
  writeLeaderboard(uid: string, entry: LeaderboardEntry): Promise<void>;
  /** Réserve un pseudo (en minuscules) pour `uid`. Renvoie false s'il appartient à un autre joueur. */
  claimUsername(lower: string, uid: string, now: number): Promise<boolean>;
}

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

export interface Caller {
  uid: string;
  /** E-mail du compte Firebase (pseudo@aurarng.local). */
  email?: string;
  displayName?: string;
}

/** Nom générique des comptes qui ne suivent pas le format pseudo@aurarng.local. */
export const GENERIC_NAME = "Joueur";

/**
 * Nom affiché (classement compris), dérivé uniquement de l'e-mail du compte,
 * unique par construction (pseudo@aurarng.local). Le `displayName` du jeton est
 * modifiable par le joueur : il ne sert qu'à conserver la casse du même pseudo.
 */
export function nameFromCaller(c: Caller): string {
  const email = c.email?.toLowerCase() ?? "";
  const local = email.endsWith(EMAIL_DOMAIN) ? email.slice(0, -EMAIL_DOMAIN.length) : "";
  if (!USERNAME_RE.test(local)) return GENERIC_NAME;
  if (c.displayName && USERNAME_RE.test(c.displayName) && c.displayName.toLowerCase() === local) return c.displayName;
  return local;
}

function asRecord(data: unknown): Record<string, unknown> {
  return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
}

export async function handleApi(
  caller: Caller,
  data: unknown,
  deps: { store: PlayerStore; rng: Rng; now: () => number },
): Promise<ApiResponse> {
  const { store, rng } = deps;
  const { uid } = caller;
  const input = asRecord(data);
  const action = input.action;

  const ban = await store.getBan(uid);
  if (ban && ban.until > deps.now()) {
    throw new ApiError("permission-denied", ban.reason || "Compte banni", { until: ban.until });
  }

  const fallbackName = nameFromCaller(caller);
  const load = (raw: unknown, now: number) => {
    const s = normalizePlayerState(raw, fallbackName, now);
    // Un nom stocké qui ne correspond pas au compte (ancien nom usurpé) est corrigé.
    if (s.name.toLowerCase() !== fallbackName.toLowerCase()) s.name = fallbackName;
    return s;
  };

  // Chaque action renvoie l'état final + des informations annexes calculées dans la même transaction.
  let extra: Omit<ApiResponse, "state" | "serverNow"> = {};
  let leaderboard = true;
  const run = (fn: (s: PlayerState, now: number) => PlayerState) =>
    store.updatePlayer(uid, (raw) => {
      const now = deps.now();
      return fn(raw ? load(raw, now) : createPlayerState(fallbackName, now), now);
    });

  let state: PlayerState;
  switch (action) {
    case "load":
      state = await run((s) => s);
      break;

    case "register": {
      const name = input.name;
      if (typeof name !== "string" || !USERNAME_RE.test(name)) {
        throw new ApiError("invalid-argument", "Pseudo invalide (3-20 caractères : lettres, chiffres, _)");
      }
      // Le pseudo doit correspondre au compte authentifié : impossible d'usurper celui d'un autre.
      if (caller.email?.toLowerCase() !== name.toLowerCase() + EMAIL_DOMAIN) {
        throw new ApiError("permission-denied", "Le pseudo ne correspond pas au compte");
      }
      if (!(await store.claimUsername(name.toLowerCase(), uid, deps.now()))) {
        throw new ApiError("already-exists", "Ce pseudo est déjà pris");
      }
      state = await run((s) => ({ ...s, name }));
      break;
    }

    case "roll": {
      const count = Number.isFinite(input.count) ? (input.count as number) : 1;
      state = await run((s, now) => {
        const out = performRolls(s, now, count, rng);
        extra = { results: out.results, achievements: out.achievements, rewards: out.rewards };
        return out.state;
      });
      break;
    }

    case "potion": {
      const id = input.potionId;
      if (!isPotionId(id)) throw new ApiError("invalid-argument", "Potion inconnue");
      state = await run((s, now) => {
        const out = drinkPotion(s, id, now);
        extra = { achievements: out.achievements, rewards: out.rewards };
        return out.state;
      });
      break;
    }

    case "equip": {
      const auraId = input.auraId;
      if (auraId !== null && (typeof auraId !== "string" || !getAura(auraId))) {
        throw new ApiError("invalid-argument", "Aura inconnue");
      }
      state = await run((s) => equipAura(s, auraId));
      break;
    }

    case "heartbeat":
      state = await run((s, now) => {
        const out = heartbeat(s, now);
        extra = { achievements: out.achievements, rewards: out.rewards };
        return out.state;
      });
      leaderboard = (extra.achievements?.length ?? 0) > 0;
      break;

    default:
      throw new ApiError("invalid-argument", "Action inconnue");
  }

  const serverNow = deps.now();
  if (leaderboard) await store.writeLeaderboard(uid, toLeaderboardEntry(state, serverNow));
  return { state, serverNow, ...extra };
}

/** Convertit une erreur du moteur en erreur d'API. */
export function toApiError(e: unknown): unknown {
  if (e instanceof GameError) {
    const code: ApiErrorCode = e.code === "cooldown" ? "resource-exhausted" : "failed-precondition";
    return new ApiError(code, e.message, { reason: e.code, retryInMs: e.retryInMs });
  }
  return e;
}
