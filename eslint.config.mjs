// Flat config langsung. eslint-config-next v16 sudah mengekspor flat config,
// jadi tidak perlu jembatan FlatCompat (yang justru membuat error circular).
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  {
    // File hasil generate (typegen Cloudflare), bukan kode yang ditulis tangan.
    ignores: ["cloudflare-env.d.ts", ".next/**", ".open-next/**", "node_modules/**"],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
];

export default config;