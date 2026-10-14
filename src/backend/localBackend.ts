/**
 * Backend de développement hors ligne : exécute exactement le même code que la
 * Cloud Function (`handleApi`) avec un stockage localStorage.
 * Aucune sécurité ici — à n'utiliser que pour développer sans déployer Firebase.
 */
import { secureRng, usernameToEmail, type LeaderboardEntry, type PlayerState } from "../../shared";
import { ApiError, handleApi, toApiError, type PlayerStore } from "../../functions/src/handlers";
import { BackendError, type AuthUser, type GameBackend } from "./types";

const KEY = "aura-rng:local";

interface LocalDb {
  session: AuthUser | null;
  accounts: Record<string, string>; // pseudo en minuscules → uid
  players: Record<string, unknown>;
  leaderboard: Record<string, LeaderboardEntry>;
  settings: Record<string, unknown>;
}

function read(): LocalDb {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as LocalDb;
  } catch {
    /* stockage indisponible ou corrompu */
  }
  return { session: null, accounts: {}, players: {}, leaderboard: {}, settings: {} };
}

function write(db: LocalDb) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* quota dépassé ou navigation privée : la partie reste en mémoire */
  }
}

export function createLocalBackend(): GameBackend {
  let db = read();
  const listeners = new Set<(u: AuthUser | null) => void>();
  const emit = () => listeners.forEach((cb) => cb(db.session));

  const store: PlayerStore = {
    async getBan() {
      return null;
    },
    async updatePlayer(uid, mutate) {
      const next: PlayerState = mutate(db.players[uid] ?? null);
      db.players[uid] = JSON.parse(JSON.stringify(next));
      write(db);
      return next;
    },
    async writeLeaderboard(uid, entry) {
      db.leaderboard[uid] = entry;
      write(db);
    },
    async claimUsername(lower, uid) {
      const owner = db.accounts[lower];
      if (owner && owner !== uid) return false;
      db.accounts[lower] = uid;
      write(db);
      return true;
    },
  };

  const login = (name: string) => {
    const lower = name.toLowerCase();
    const uid = db.accounts[lower] ?? `local-${lower}`;
    db.accounts[lower] = uid;
    db.session = { uid, name };
    write(db);
    emit();
  };

  return {
    kind: "local",

    onAuthChange(cb) {
      listeners.add(cb);
      queueMicrotask(() => cb(db.session));
      return () => listeners.delete(cb);
    },

    async signIn(name) {
      if (!db.accounts[name.toLowerCase()]) throw new BackendError("auth", "Aucun compte local avec ce pseudo.");
      login(name);
    },

    async register(name) {
      if (db.accounts[name.toLowerCase()]) throw new BackendError("auth", "Ce pseudo est déjà utilisé.");
      login(name);
      await this.call({ action: "register", name });
    },

    async signOut() {
      db.session = null;
      write(db);
      emit();
    },

    async call(req) {
      const session = db.session;
      if (!session) throw new BackendError("auth", "Non connecté");
      db = read();
      try {
        return await handleApi(
          { uid: session.uid, email: usernameToEmail(session.name), displayName: session.name },
          req,
          { store, rng: secureRng, now: Date.now },
        );
      } catch (raw) {
        const e = toApiError(raw);
        if (e instanceof ApiError) {
          const d = (e.details ?? {}) as { retryInMs?: number };
          throw new BackendError(e.code === "resource-exhausted" ? "cooldown" : "invalid", e.message, d);
        }
        throw new BackendError("unknown", String(e));
      }
    },

    async leaderboard(category, limit) {
      const viewer = db.session?.uid;
      return Object.entries(read().leaderboard)
        .sort(([, a], [, b]) => b[category] - a[category] || a.updatedAt - b.updatedAt)
        .slice(0, limit)
        .map(([uid, e], i) => ({
          rank: i + 1,
          me: uid === viewer,
          name: e.name,
          rolls: e.rolls,
          bestOdds: e.bestOdds,
          bestAuraId: e.bestAuraId,
          collection: e.collection,
          achievements: e.achievements,
          equipped: e.equipped,
        }));
    },

    async loadSettings(uid) {
      return (read().settings[uid] as never) ?? null;
    },

    async saveSettings(uid, settings) {
      db.settings[uid] = settings;
      write(db);
    },
  };
}
