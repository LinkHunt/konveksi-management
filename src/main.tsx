// Entry point aplikasi (Mode React + Vite).
//
// urutan boot:
//   1. inisialisasi sql.js (WASM) + buka file .db dari disk (initDb).
//   2. render React setelah database siap, supaya tidak ada komponen yang
//      membaca getDb() saat null.
//   3. router pakai HashRouter (#/...), aman untuk file:// di WebView.

import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import Root from "./app/layout";
import "./app/globals.css";
import { initDb } from "./lib/db";

async function boot() {
  // Tunggu database siap SEBELUM render, supaya tidak ada komponen yang
  // memanggil getDb() saat database masih null dan tidak ada flash kosong.
  await initDb();

  const rootEl = document.getElementById("root");
  if (!rootEl) throw new Error("Elemen root tidak ditemukan.");

  createRoot(rootEl).render(
    <HashRouter>
      <Root />
    </HashRouter>,
  );
}

void boot();