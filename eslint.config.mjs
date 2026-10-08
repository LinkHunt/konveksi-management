// Flat config ESLint 9 untuk aplikasi Vite SPA offline.
// eslint-config-next tidak dipakai lagi (Next.js sudah ditinggalkan).
// Config dipertahankan supaya `npm run lint` tetap bisa jalan; aturan dibiarkan
// minimal (belum di-seed rule lain), fokus utama adalah typecheck via tsc.

export default [
  {
    ignores: ["node_modules/**", "dist/**", "android/**", "*.tsbuildinfo"],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
];