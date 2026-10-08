import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Vite config untuk SPA offline (Capacitor Android).
// `base: "./"` penting: semua aset dimuat relatif, jalan dari file:// di WebView.
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    // sql.js wasm ikut disalin ke dist/ dan dimuat via locateFile.
    assetsInlineLimit: 0,
  },
  server: {
    fs: {
      // Izinkan akses file node_modules (sql.js wasm).
      allow: [".."],
    },
  },
});