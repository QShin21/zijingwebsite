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
    files: ['miniprogram/**/*.js'],
    languageOptions: { globals: { wx: 'readonly', App: 'readonly', Page: 'readonly',
      getApp: 'readonly', getCurrentPages: 'readonly', module: 'readonly', require: 'readonly',
      setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly' } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
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
