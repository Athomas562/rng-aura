import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["shared/**/*.test.ts", "functions/src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
