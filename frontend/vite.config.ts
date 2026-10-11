import { resolve } from "node:path";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [solid(), tailwindcss()],
  resolve: {
    alias: {
      "~": resolve(__dirname, "src"),
    },
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8000",
      "/documents": "http://127.0.0.1:8000",
    },
  },
  build: {
    chunkSizeWarningLimit: 2000,
  },
});
