import { initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { get, getDatabase, limitToLast, orderByChild, query, ref, set } from "firebase/database";
import { FunctionsError, getFunctions, httpsCallable } from "firebase/functions";
import { EMAIL_DOMAIN, usernameToEmail, type ApiRequest, type ApiResponse, type LeaderboardEntry } from "../../shared";
import type { Settings } from "../settings/settings";
import { BackendError, type GameBackend, type LeaderboardRow } from "./types";

/** Configuration publique du projet Firebase existant (non secrète par nature). */
const firebaseConfig = {
  apiKey: "AIzaSyBypIoHBDNZ657Uw1eTJ9mLU53Hr_jK1kc",
  authDomain: "rng-aura.firebaseapp.com",
  databaseURL: "https://rng-aura-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "rng-aura",
  storageBucket: "rng-aura.firebasestorage.app",
  messagingSenderId: "137067422327",
  appId: "1:137067422327:web:929f14f1842fe990b8dc72",
};

const AUTH_MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Pseudo ou mot de passe incorrect.",
  "auth/wrong-password": "Mot de passe incorrect.",
  "auth/user-not-found": "Aucun compte avec ce pseudo.",
  "auth/email-already-in-use": "Ce pseudo est déjà utilisé.",
  "auth/weak-password": "Mot de passe trop faible (6 caractères minimum).",
  "auth/too-many-requests": "Trop de tentatives, réessaie plus tard.",
  "auth/network-request-failed": "Problème réseau.",
};

function authError(e: unknown): BackendError {
  const code = (e as { code?: string })?.code ?? "";
  return new BackendError("auth", AUTH_MESSAGES[code] ?? "Erreur de connexion.");
}

function callError(e: unknown): BackendError {
  if (e instanceof FunctionsError) {
    const details = (e.details ?? {}) as { retryInMs?: number; until?: number };
    switch (e.code) {
      case "functions/resource-exhausted":
        return new BackendError("cooldown", e.message, { retryInMs: details.retryInMs });
      case "functions/permission-denied":
        return details.until
          ? new BackendError("banned", e.message, { until: details.until })
          : new BackendError("invalid", e.message);
      case "functions/invalid-argument":
      case "functions/failed-precondition":
      case "functions/already-exists":
        return new BackendError("invalid", e.message);
      case "functions/unauthenticated":
        return new BackendError("auth", "Session expirée, reconnecte-toi.");
      case "functions/unavailable":
      case "functions/deadline-exceeded":
        return new BackendError("network", "Serveur injoignable.");
    }
  }
  return new BackendError("unknown", "Erreur inattendue.");
}

export function createFirebaseBackend(): GameBackend {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getDatabase(app);
  const api = httpsCallable<ApiRequest, ApiResponse>(getFunctions(app, "europe-west1"), "api");

  const nameOf = (email: string | null, displayName: string | null) =>
    displayName || (email?.endsWith(EMAIL_DOMAIN) ? email.slice(0, -EMAIL_DOMAIN.length) : "Joueur");

  return {
    kind: "firebase",

    onAuthChange(cb) {
      return onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, name: nameOf(u.email, u.displayName) } : null));
    },

    async signIn(name, password) {
      try {
        await signInWithEmailAndPassword(auth, usernameToEmail(name), password);
      } catch (e) {
        throw authError(e);
      }
    },

    async register(name, password) {
      try {
        const cred = await createUserWithEmailAndPassword(auth, usernameToEmail(name), password);
        await updateProfile(cred.user, { displayName: name });
        // Force un jeton à jour (contenant le displayName) avant d'appeler l'API.
        await cred.user.getIdToken(true);
      } catch (e) {
        throw authError(e);
      }
      try {
        await api({ action: "register", name });
      } catch (e) {
        throw callError(e);
      }
    },

    async signOut() {
      await signOut(auth);
    },

    async call(req) {
      try {
        return (await api(req)).data;
      } catch (e) {
        throw callError(e);
      }
    },

    async leaderboard(category, limit) {
      const snap = await get(query(ref(db, "v2/leaderboard"), orderByChild(category), limitToLast(limit)));
      const rows: LeaderboardRow[] = [];
      snap.forEach((child) => {
        rows.push({ uid: child.key!, ...(child.val() as LeaderboardEntry) });
      });
      return rows.reverse();
    },

    async loadSettings(uid) {
      const snap = await get(ref(db, `v2/settings/${uid}`));
      return snap.exists() ? (snap.val() as Partial<Settings>) : null;
    },

    async saveSettings(uid, settings) {
      await set(ref(db, `v2/settings/${uid}`), settings);
    },
  };
}
