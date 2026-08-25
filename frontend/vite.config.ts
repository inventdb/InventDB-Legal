import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The dev server proxies /api to the Python backend so the SPA can always call
// same-origin "/api" in both development and production.
//
// The port is 5174, not Vite's default 5173, so this app and a sibling InventDB
// app can be run side by side. Sharing the default meant whichever started
// second silently attached to the first one's server — and a Playwright run
// with `reuseExistingServer` then tested the wrong application while reporting
// on this one. Override with VITE_PORT.
const DEV_PORT = Number(process.env.VITE_PORT ?? 5174);

export default defineConfig({
  plugins: [react()],
  server: {
    port: DEV_PORT,
    // Fail rather than roam: a silent hop to the next free port is what let the
    // two apps collide in the first place.
    strictPort: true,
    proxy: {
      "/api": {
        target: process.env.VITE_PROXY_TARGET || "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          charts: ["recharts"],
          query: ["@tanstack/react-query", "axios"],
        },
      },
    },
  },
});
