import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  root: ".",
  appType: "spa",
  plugins: [react()],
  server: { port: 5173, open: true },

  resolve: {
    alias: { "@": "/src" },
    // keep resolver predictable; no special conditions
    dedupe: [],
    conditions: []
  },

  // stop env/ts scanning from walking up your Desktop tree
  envDir: ".",

  optimizeDeps: {
    include: [
      "three",
      "three/examples/jsm/controls/OrbitControls.js",
      "three/examples/jsm/loaders/GLTFLoader.js",
      "three/examples/jsm/loaders/DRACOLoader.js",
      "three/examples/jsm/libs/meshopt_decoder.module.js"
    ],
    esbuildOptions: {
      absWorkingDir: path.resolve(__dirname)
    }
  },

  build: {
    sourcemap: true,
    outDir: "dist",
    emptyOutDir: true
  }
});
