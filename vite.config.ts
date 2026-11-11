import { defineConfig } from "vite";

// Relative base so the build works from any folder (Poki uploads a zip of dist/).
export default defineConfig({
  base: "./",
  build: {
    target: "es2020",
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1600,
    rollupOptions: { output: { manualChunks: { phaser: ["phaser"] } } },
  },
  server: { host: true, port: 5173 },
});
