// Root layout aplikasi (Vite SPA offline). Bukan lagi Next.js layout: tidak
// ada metadata/font server. Rute didefinisikan di sini via react-router, dan
// tiap halaman dipakai sebagai komponen biasa. HashRouter sudah dipasang di
// src/main.tsx (file:// aman), jadi di sini cukup Routes.
//
// Rute:
//   /                Dashboard (ringkasan kurang + setoran terbaru)
//   /hasil-potong    Catatan hasil potongan (sumber data)
//   /setoran         Setoran ke atasan
//   /kurang          Belum di setorkan (hasil potong - setoran)
//   /master/pemilik, /master/model, /master/warna    Master data

import { Route, Routes } from "react-router-dom";
import AppLayout from "./(app)/layout";
import DashboardPage from "./(app)/page";
import HasilPotongPage from "./(app)/hasil-potong/page";
import SetoranPage from "./(app)/setoran/page";
import KurangPage from "./(app)/kurang/page";
import PemilikPage from "./(app)/master/pemilik/page";
import ModelPage from "./(app)/master/model/page";
import WarnaPage from "./(app)/master/warna/page";
import BackupPage from "./(app)/backup/page";

export default function Root() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/hasil-potong" element={<HasilPotongPage />} />
        <Route path="/setoran" element={<SetoranPage />} />
        <Route path="/kurang" element={<KurangPage />} />
        <Route path="/master/pemilik" element={<PemilikPage />} />
        <Route path="/master/model" element={<ModelPage />} />
        <Route path="/master/warna" element={<WarnaPage />} />
        <Route path="/backup" element={<BackupPage />} />
      </Routes>
    </AppLayout>
  );
}