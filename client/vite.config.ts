import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Resolve @rox/shared to its TypeScript source so the client and server share one
// contract with no build step in dev.
export default defineConfig({
  resolve: {
    alias: {
      "@rox/shared": fileURLToPath(new URL("../shared/src/index.ts", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
