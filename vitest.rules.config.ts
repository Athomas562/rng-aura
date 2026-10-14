import { defineConfig } from "vitest/config";

// Tests d'accès des règles Realtime Database contre l'émulateur local (voir `npm run test:rules`).
export default defineConfig({
  test: {
    include: ["tests/rules/**/*.emulator.test.ts"],
    testTimeout: 20_000,
    fileParallelism: false,
  },
});
