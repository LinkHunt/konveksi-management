import type { CapacitorConfig } from "@capacitor/cli";

// Konfigurasi Capacitor untuk aplikasi Android offline.
//
// `appId` = package Android (reverse-domain). Ganti di sini bila ingin pakai
// identitas sendiri. `webDir` = hasil `vite build` (dist/).
//
// android: allowMixedContent tidak perlu karena semua data lokal; loading
// halaman via file:// (webviewLoadWithMode default).

const config: CapacitorConfig = {
  appId: "id.konveksi.management",
  appName: "Konveksi",
  webDir: "dist",
  android: {
    // WebView memuat aset dari "app/public", bukan server jaringan. Biarkan
    // default (allowMixedContent=false) — app ini tidak memanggil HTTP.
  },
};

export default config;