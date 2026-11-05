import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Phase 1a has database tests only (pnpm db:test); app tests arrive in 1b.
    passWithNoTests: true,
  },
});
