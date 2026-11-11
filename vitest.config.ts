import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    // a test that fails once on a slow shared CI runner is retried (reported as flaky); real failures fail 3 times
    retry: process.env.CI ? 2 : 0,
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["**/*.test.*", "src/test/**", "src/**/*.d.ts", "src/routeTree.gen.ts", "src/main.tsx"],
      // shards (CI) only collect: the 95% floor is applied once on the merged report
      thresholds: process.env.VITEST_SHARD ? undefined : { statements: 95, branches: 95, functions: 95, lines: 95 },
    },
  },
});
