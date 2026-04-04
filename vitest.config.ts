import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    root: ".",
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts"],
    exclude: ["contracts/**", "node_modules/**"],
    server: {
      deps: {
        inline: ["convex", "convex-test"],
      },
    },
  },
});
