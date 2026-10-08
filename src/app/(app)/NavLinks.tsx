"use client";

import { Link, useLocation } from "react-router-dom";

/*
 * Isi drawer navigasi. Ikon pakai SVG inline, bukan karakter teks. Karakter
 * seperti ⌂ dan ⚙ digambar berbeda tiap font, sehingga di HP bisa tampil
 * kotak atau kosong. SVG selalu sama di mana saja.
 *
 * Tidak ada login/logout lagi — app offline, satu user (bibi).
 */

type Item = { href: string; label: string; d: string };

const UTAMA: Item[] = [
  { href: "/", label: "Beranda", d: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  {
    href: "/hasil-potong",
    label: "Hasil Potong",
    d: "M12 21V10m0 0 4 4m-4-4-4 4M4 7V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2",
  },
  { href: "/setoran", label: "Setoran", d: "M12 3v11m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" },
  { href: "/kurang", label: "Belum di setorkan", d: "M4 6h16M4 12h16M4 18h10" },
];

const MASTER: Item[] = [
  { href: "/master/pemilik", label: "Pemilik", d: "" },
  { href: "/master/model", label: "Model Baju", d: "" },
  { href: "/master/warna", label: "Warna", d: "" },
  { href: "/backup", label: "Cadangan & Pulihkan", d: "" },
];

function aktif(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function Ikon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

export default function NavLinks({ onPilih }: { onPilih: () => void }) {
  const { pathname } = useLocation();

  return (
    <nav className="flex-1 overflow-y-auto px-3 pb-4">
      <div className="flex flex-col gap-0.5">
        {UTAMA.map((it) => {
          const on = aktif(pathname, it.href);
          return (
            <Link
              key={it.href}
              to={it.href}
              onClick={onPilih}
              aria-current={on ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                on
                  ? "bg-aksen-lembut font-semibold text-aksen-gelap"
                  : "text-teks-lembut hover:bg-permukaan-2 hover:text-teks"
              }`}
            >
              <Ikon d={it.d} />
              {it.label}
            </Link>
          );
        })}
      </div>

      <p className="mt-5 mb-1 px-3 text-xs font-semibold tracking-wide text-teks-sangat-lembut">
        MASTER
      </p>
      <div className="flex flex-col gap-0.5">
        {MASTER.map((it) => {
          const on = aktif(pathname, it.href);
          return (
            <Link
              key={it.href}
              to={it.href}
              onClick={onPilih}
              aria-current={on ? "page" : undefined}
              className={`rounded-lg py-2.5 pl-12 pr-3 text-sm transition-colors ${
                on
                  ? "bg-aksen-lembut font-semibold text-aksen-gelap"
                  : "text-teks-lembut hover:bg-permukaan-2 hover:text-teks"
              }`}
            >
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}