import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["__test__/**/*.test.{js,ts}"],
    fileParallelism: false,
    testTimeout: 15000,
  },
});
