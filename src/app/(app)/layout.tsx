import { redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { requireSession } from "@/lib/auth";
import LogoutButton from "./LogoutButton";
import NavLinks from "./NavLinks";

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
      {/* Sidebar hanya muncul di layar lg ke atas. Di bawah itu, navigasi ada
          di NavLinks sebagai bottom bar supaya tetap terjangkau satu tangan. */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-garis bg-permukaan lg:flex">
        <div className="px-4 py-4">
          <Link href="/" className="text-base font-semibold tracking-tight">
            Management Konveksi
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          <NavLinks mode="sidebar" />
        </nav>
        <div className="border-t border-garis px-4 py-3">
          <p className="truncate text-xs text-teks-lembut">Masuk sebagai</p>
          <p className="truncate text-sm font-medium">{user.username}</p>
        </div>
      </aside>

      {/* Header untuk layar sempit. */}
      <header className="sticky top-0 z-20 border-b border-garis bg-permukaan/90 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="text-sm font-semibold">
            Management Konveksi
          </Link>
          <div className="flex items-center gap-2">
            <span className="max-w-24 truncate text-xs text-teks-lembut">{user.username}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* pb-20 memberi ruang untuk bottom nav di layar sempit. */}
      <main className="px-4 py-5 pb-24 lg:ml-60 lg:px-6 lg:pb-8">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>

      <div className="lg:hidden">
        <NavLinks mode="bottom" />
      </div>
    </div>
  );
}