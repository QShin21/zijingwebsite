import js from "@eslint/js";
import ts from "typescript-eslint";
export default ts.config(
  {
    ignores: [
      ".next/**",
      "src/payload-types.ts",
      "src/migrations/**",
      "src/app/(payload)/admin/importMap.js",
      "node_modules/**",
      ".data/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    languageOptions: {
      globals: {
        process: "readonly",
        Buffer: "readonly",
        console: "readonly",
        setInterval: "readonly",
        URL: "readonly",
        fetch: "readonly",
        Response: "readonly",
        Headers: "readonly",
        crypto: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
);
