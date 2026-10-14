import { initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { get, getDatabase, ref, set } from "firebase/database";
import { EMAIL_DOMAIN, usernameToEmail, type ApiRequest } from "../../shared";
import type { Settings } from "../settings/settings";
import { callApi, fetchLeaderboard } from "./apiClient";
import { BackendError, type GameBackend } from "./types";

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

export function createFirebaseBackend(): GameBackend {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getDatabase(app);
  /** API du Worker Cloudflare, authentifiée par le jeton Firebase de l'utilisateur connecté. */
  const idToken = async () => {
    const user = auth.currentUser;
    if (!user) throw new BackendError("auth", "Connexion requise.");
    return user.getIdToken();
  };
  const api = (req: ApiRequest) => callApi(req, idToken);

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
      await api({ action: "register", name });
    },

    async signOut() {
      await signOut(auth);
    },

    call: api,

    leaderboard: (category, limit) => fetchLeaderboard(category, limit, idToken),

    async loadSettings(uid) {
      const snap = await get(ref(db, `v2/settings/${uid}`));
      return snap.exists() ? (snap.val() as Partial<Settings>) : null;
    },

    async saveSettings(uid, settings) {
      await set(ref(db, `v2/settings/${uid}`), settings);
    },
  };
}
