import { defineConfig } from "vitest/config";

// `node:sqlite` is a recent Node builtin that vite's resolver doesn't yet know,
// so it tries (and fails) to bundle it. Mark it external so it's required at
// runtime like any other Node builtin.
export default defineConfig({
  test: {
    environment: "node",
    server: {
      deps: {
        external: [/node:sqlite/],
      },
    },
    coverage: {
      provider: "v8",
      include: ["src/agentTools.ts", "src/http.ts", "src/garden/model.ts", "src/db.ts"],
      thresholds: {
        lines: 60,
        functions: 70,
        branches: 58,
      },
    },
  },
});
