import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

const sharedRules = {
  "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
  "@typescript-eslint/no-explicit-any": "warn",
};

export default tseslint.config(
  {
    ignores: [
      "dist",
      "node_modules",
      "server/node_modules",
      "**/*.tsbuildinfo",
      "playwright-report",
      "test-results",
    ],
  },
  // Frontend (browser + React hooks)
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...sharedRules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  // Server + tooling (Node)
  {
    files: ["server/src/**/*.ts", "e2e/**/*.ts", "*.config.{ts,js}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.node },
    rules: sharedRules,
  },
);
