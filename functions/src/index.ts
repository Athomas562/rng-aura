import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { secureRng, type PlayerState } from "../../shared/index";
import { ApiError, handleApi, toApiError, type Ban, type PlayerStore } from "./handlers";

initializeApp();
const db = getDatabase();

/** Données du nouveau jeu, isolées de celles de l'ancienne version. */
const ROOT = "v2";

const store: PlayerStore = {
  async getBan(uid) {
    const snap = await db.ref(`bans/${uid}`).get();
    return snap.exists() ? (snap.val() as Ban) : null;
  },

  async updatePlayer(uid, mutate) {
    const ref = db.ref(`${ROOT}/players/${uid}`);
    // Le SDK appelle d'abord la transaction avec la valeur en cache (souvent null).
    // On sait si le nœud existe pour ne pas interrompre la transaction sur cette valeur factice.
    const existed = (await ref.get()).exists();
    let failure: unknown = null;
    let result: PlayerState | null = null;

    const tx = await ref.transaction((current) => {
      failure = null;
      try {
        result = mutate(current);
        return result;
      } catch (e) {
        failure = e;
        if (current === null && existed) {
          // Valeur de cache obsolète : on renvoie une valeur quelconque, le serveur la rejettera
          // (hash différent) et relancera la transaction avec les vraies données.
          return { stale: true };
        }
        return undefined; // annule
      }
    });

    if (failure) throw failure;
    if (!tx.committed || !result) throw new ApiError("failed-precondition", "Transaction annulée, réessaie");
    return result;
  },

  async writeLeaderboard(uid, entry) {
    await db.ref(`${ROOT}/leaderboard/${uid}`).set(entry);
  },

  async claimUsername(lower, uid, now) {
    const ref = db.ref(`usernames/${lower}`);
    const tx = await ref.transaction((current) => {
      if (current && current.uid !== uid) return undefined;
      return current ?? { uid, createdAt: now };
    });
    return tx.committed && tx.snapshot.val()?.uid === uid;
  },
};

export const api = onCall(
  { region: "europe-west1", maxInstances: 10, memory: "256MiB", timeoutSeconds: 20 },
  async (req) => {
    if (!req.auth) throw new HttpsError("unauthenticated", "Connexion requise");
    try {
      return await handleApi(
        {
          uid: req.auth.uid,
          email: req.auth.token.email,
          displayName: typeof req.auth.token.name === "string" ? req.auth.token.name : undefined,
        },
        req.data,
        { store, rng: secureRng, now: Date.now },
      );
    } catch (raw) {
      const e = toApiError(raw);
      if (e instanceof ApiError) throw new HttpsError(e.code, e.message, e.details);
      console.error("api error", e);
      throw new HttpsError("internal", "Erreur serveur");
    }
  },
);
