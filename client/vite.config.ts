import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Resolve @rox/shared to its TypeScript source so the client and server share one
// contract with no build step in dev.
export default defineConfig({
  resolve: {
    alias: {
      "@rox/shared": fileURLToPath(new URL("../shared/src/index.ts", import.meta.url)),
      "@rox/engine": fileURLToPath(new URL("../engine/src/index.ts", import.meta.url)),
    },
  },
  build: {
    // Emit to a repo-root `dist/` so the Vercel project (Root Directory = repo
    // root, Vite preset → expects `dist`) finds the bundle with no extra config.
    outDir: fileURLToPath(new URL("../dist", import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    host: true,
  },
});
