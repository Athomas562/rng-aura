import { createFirebaseBackend } from "./firebaseBackend";
import { createLocalBackend } from "./localBackend";
import type { GameBackend } from "./types";

export * from "./types";

/** `VITE_BACKEND=local` (voir .env.offline) active le mode hors ligne. */
export const backend: GameBackend =
  import.meta.env.VITE_BACKEND === "local" ? createLocalBackend() : createFirebaseBackend();
