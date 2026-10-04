import { redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { requireSession } from "@/lib/auth";
import LogoutButton from "./LogoutButton";

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
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="text-sm font-semibold">
            Management Konveksi
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-500">{user.username}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-5">{children}</main>
    </div>
  );
}