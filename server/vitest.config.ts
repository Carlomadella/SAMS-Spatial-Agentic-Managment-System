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
  },
});
