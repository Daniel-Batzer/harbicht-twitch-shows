import { defineConfig } from "vitest/config";

// Pure TypeScript domain tests only: no DOM environment, no path aliases
// (domain code uses relative imports).
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
