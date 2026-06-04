import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import prettier from "eslint-config-prettier";

export default [
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.vite/**",
      "**/coverage/**",
      "**/*.tsbuildinfo",
      "server/server/data/**",
      ".codex-logs/**"
    ]
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module"
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "prefer-const": "warn",
      "no-empty": ["warn", { allowEmptyCatch: true }]
    }
  },

  {
    files: ["server/**/*.ts"],
    languageOptions: {
      globals: { ...globals.node }
    }
  },

  {
    files: ["client/**/*.{ts,tsx}", "admin-client/**/*.{ts,tsx}"],
    plugins: { react, "react-hooks": reactHooks },
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true }
      }
    },
    settings: {
      react: { version: "18.3" }
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/no-unescaped-entities": "off"
    }
  },

  {
    files: ["**/*.config.{js,ts,mjs,cjs}", "**/vite.config.{js,ts}", "**/vitest.config.{js,ts}"],
    languageOptions: {
      globals: { ...globals.node }
    }
  },

  {
    files: ["**/*.test.{ts,tsx}", "**/tests/**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.node }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off"
    }
  },

  prettier
];
