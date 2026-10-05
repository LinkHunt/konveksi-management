import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { requireSession } from "@/lib/auth";
import DrawerNav from "./DrawerNav";

// Pengecekan login dilakukan di layout, bukan middleware: middleware Node.js
// belum didukung adapter OpenNext di Cloudflare Workers.
export default async function AppLayout({ children }: { children: ReactNode }) {
  let user: { id: number; username: string } | null = null;
  try {
    user = await requireSession();
  } catch {
    redirect("/login");
  }

  return (
    <div className="min-h-dvh">
      {/*
        Navigasi sekarang berupa drawer yang dipanggil dari hamburger di app
        bar, sama seperti aplikasi Android. Sidebar fixed dan bottom bar yang
        sebelumnya ada sudah dihapus, jadi navigasi tidak lagi pindah tempat
        tergantung lebar layar.
      */}
      <DrawerNav username={user.username} />

      {/* px-4 + pt-4 aman untuk layar sempit; pb ekstra diberikan untuk
          gesture bar Android supaya konten terakhir tidak tertutup. */}
      <main className="px-4 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-5 sm:pt-5">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}