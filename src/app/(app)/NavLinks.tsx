"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; short: string; icon: string };

/*
 * Navigasi dipakai dua kali: sidebar di layar lebar, bottom bar di layar
 * sempit. Keduanya dari daftar yang sama supaya tidak bisa berbeda isi.
 *
 * Ikon pakai karakter teks, bukan library ikon, supaya tidak menambah
 * dependency untuk sesuatu yang kecil.
 */
const UTAMA: Item[] = [
  { href: "/", label: "Beranda", short: "Beranda", icon: "⌂" },
  { href: "/setoran", label: "Setoran", short: "Setoran", icon: "↓" },
  { href: "/bahan-keluar", label: "Bahan Keluar", short: "Bahan", icon: "↑" },
  { href: "/sisa", label: "Sisa", short: "Sisa", icon: "≡" },
];

const MASTER: Item[] = [
  { href: "/master/pemilik", label: "Pemilik", short: "Pemilik", icon: "•" },
  { href: "/master/model", label: "Model Baju", short: "Model", icon: "•" },
  { href: "/master/warna", label: "Warna", short: "Warna", icon: "•" },
  { href: "/master/penjahit", label: "Penjahit", short: "Penjahit", icon: "•" },
];

function aktif(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function kelas(pathname: string, href: string, mode: "sidebar" | "bottom"): string {
  const on = aktif(pathname, href);
  if (mode === "bottom") {
    return `flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] transition-colors ${
      on ? "text-aksen" : "text-teks-lembut"
    }`;
  }
  return `block rounded-lg px-3 py-2 text-sm transition-colors ${
    on ? "bg-aksen-lembut font-medium text-aksen-gelap" : "text-teks-lembut hover:bg-permukaan-2"
  }`;
}

export default function NavLinks({ mode }: { mode: "sidebar" | "bottom" }) {
  const pathname = usePathname() ?? "/";

  if (mode === "bottom") {
    return (
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-garis bg-permukaan/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        {UTAMA.map((it) => (
          <Link key={it.href} href={it.href} className={kelas(pathname, it.href, mode)}>
            <span aria-hidden className="text-lg leading-none">
              {it.icon}
            </span>
            <span>{it.short}</span>
          </Link>
        ))}
        <details className="flex flex-1 flex-col items-center">
          <summary className="flex list-none flex-col items-center gap-0.5 py-1.5 text-[11px] text-teks-lembut">
            <span aria-hidden className="text-lg leading-none">
              ⚙
            </span>
            <span>Master</span>
          </summary>
          <div className="fixed inset-x-0 bottom-14 border-t border-garis bg-permukaan px-2 pb-3 shadow-lg">
            <div className="grid grid-cols-2 gap-1 py-2">
              {MASTER.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  className="rounded-lg px-3 py-2.5 text-sm text-teks hover:bg-permukaan-2"
                >
                  {it.label}
                </Link>
              ))}
            </div>
          </div>
        </details>
      </nav>
    );
  }

  return (
    <>
      <div className="px-1">
        {UTAMA.map((it) => (
          <Link key={it.href} href={it.href} className={kelas(pathname, it.href, mode)}>
            {it.label}
          </Link>
        ))}
      </div>
      <p className="mt-5 px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-teks-sangat-lembut">
        Master
      </p>
      <div className="px-1">
        {MASTER.map((it) => (
          <Link key={it.href} href={it.href} className={kelas(pathname, it.href, mode)}>
            {it.label}
          </Link>
        ))}
      </div>
    </>
  );
}