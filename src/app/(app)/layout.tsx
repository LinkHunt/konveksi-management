"use client";

import type { ReactNode } from "react";
import DrawerNav from "./DrawerNav";

/*
 * Layout untuk seluruh halaman aplikasi (di dalam rute). Tidak ada lagi
 * pengecekan login/server: app offline untuk satu user (bibi), semua halaman
 * langsung jalan. Navigasi berupa drawer yang dipanggil dari hamburger di app
 * bar, sama seperti aplikasi Android.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <DrawerNav />

      {/* px-4 + pt-4 aman untuk layar sempit; pb ekstra diberikan untuk
          gesture bar Android supaya konten terakhir tidak tertutup. */}
      <main className="px-4 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-5 sm:pt-5">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}