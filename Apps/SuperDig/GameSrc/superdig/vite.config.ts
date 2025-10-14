import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./", // relative paths so you can host anywhere
  build: {
    target: "es2018",
    sourcemap: false,
    assetsInlineLimit: 0,
    rollupOptions: {
      output: { assetFileNames: "assets/[name]-[hash][extname]", chunkFileNames: "assets/[name]-[hash].js", entryFileNames: "assets/[name]-[hash].js" }
    }
  }
});
