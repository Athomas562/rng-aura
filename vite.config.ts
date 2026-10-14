import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Le mode local (moteur exécuté dans le navigateur, sans validation serveur ni vrai classement)
  // ne doit jamais partir en production, même si VITE_BACKEND=local est défini par erreur sur l'hébergeur.
  const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env };
  if (mode === "production" && env.VITE_BACKEND === "local") {
    throw new Error("VITE_BACKEND=local est interdit pour un build de production : le jeu doit utiliser Firebase.");
  }

  return {
    plugins: [react()],
    test: {
      include: ["shared/**/*.test.ts", "functions/src/**/*.test.ts", "src/**/*.test.tsx"],
    },
  };
});
