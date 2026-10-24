import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for the pure logic in src/lib (wire seams, capability gates, config
// resolution). Node environment: nothing here renders, and the clients read
// config through runtimeConfig(), which takes its server path when there is no
// `window`.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
