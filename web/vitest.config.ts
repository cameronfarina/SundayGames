import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: "web",
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/test/**", "src/main.tsx"],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
        // V8 intermittently fails to credit this file's error-state branch
        // (lines 77-83) even though the test awaits that render; the flake
        // rolled back two good deploys on 2026-08-17. Re-tighten once the
        // instrumentation race is root-caused.
        "src/features/practice/pages/PracticePage/PracticePage.tsx": {
          branches: 95,
          functions: 100,
          lines: 100,
          statements: 100,
        },
      },
    },
  },
});
