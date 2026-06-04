import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.{test,spec}.{ts,tsx}", "tests/**/*.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.vite/**"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["server/src/**/*.ts", "shared/**/*.ts"],
      exclude: ["**/*.d.ts", "**/dist/**"]
    }
  }
});
