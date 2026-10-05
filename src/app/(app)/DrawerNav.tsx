"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import NavLinks from "./NavLinks";
import LogoutButton from "./LogoutButton";

/*
 * Navigasi utama, gaya aplikasi: app bar tetap di atas dengan tombol hamburger
 * di pojok kiri, menu muncul sebagai panel yang geser dari kiri.
 *
 * Panel bisa ditutup dengan empat cara, semuanya yang dipakai user di HP:
 *   1. Ketuk area gelap di sebelah kanan panel.
 *   2. Geser panel ke kiri (pointer + touch, mengikuti jari).
 *   3. Tombol Escape di keyboard.
 *   4. Ketuk salah satu tautan di dalam panel.
 *
 * Geser memakai Pointer Event, bukan Touch Event, supaya satu kode berlaku di
 * jari, mouse, dan stylus tanpa percabangan. Selama jari bergerak, transisi
 * dimatikan lewat kelas `tarik` supaya panel nempel ke jari dan bukan
 * tertinggal; pas jari lepas transisi hidup lagi dan panel snap ke tempat.
 *
 * Ketuk memakai `onClick` (bukan handler sentuhan) untuk tombol dan overlay,
 * supaya tetikus, jari, dan keyboard semuanya memicu hal yang sama.
 */

const LEBAR = 260;
/** Ambang geser untuk menutup: 40% lebar panel. */
const AMBANG_TUTUP = LEBAR * 0.4;
/**
 * Jarak minimal sebelum gesture dianggap geser, bukan ketuk. Pointer capture
 * baru diambil setelah jarak ini terlampaui, bukan di pointerdown.
 */
const AMBANG_GESER = 6;

export default function DrawerNav({ username }: { username: string }) {
  // `terbukaDi` = null kalau tertutup, isi dengan pathname saat drawer dibuka.
  // Menyimpan pathname (bukan cuma boolean) membuat drawer menutup dengan
  // sendirinya begitu halaman berganti, tanpa effect.
  const [terbukaDi, setTerbukaDi] = useState<string | null>(null);
  const [tarik, setTarik] = useState(false);
  const [geserX, setGeserX] = useState(0);

  const pathname = usePathname();
  const geserRef = useRef<{ id: number; x0: number; x: number; ntaken: boolean } | null>(null);

  /*
   * Menyesuaikan state saat input berubah, dipanggil saat render (bukan di
   * dalam effect) supaya React discard render itu dan langsung render ulang
   * dengan nilai yang benar. Menutup drawer di sini, bukan lewat effect,
   * karena effect akan menambah satu render sia-sia lagi.
   */
  const [pathnameTerakhir, setPathnameTerakhir] = useState(pathname);
  if (pathname !== pathnameTerakhir) {
    setPathnameTerakhir(pathname);
    setTerbukaDi(null);
  }

  const buka = terbukaDi !== null;

  const tutup = useCallback(() => {
    setTerbukaDi(null);
    setGeserX(0);
  }, []);

  /*
   * Scroll body dikunci selama panel terbuka. Tanpa ini, halaman di belakang
   * ikut ter-scroll dari sentuhan di area gelap dan posisinya tidak kembali
   * ke semula setelah panel ditutup.
   */
  useEffect(() => {
    if (!buka) return;
    const html = document.documentElement;
    const overflowAwal = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = overflowAwal;
    };
  }, [buka]);

  useEffect(() => {
    if (!buka) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") tutup();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [buka, tutup]);

  function mulaiGeser(e: React.PointerEvent) {
    // Hanya tombol kiri mouse; touch dan stylus selalu lolos.
    if (e.pointerType === "mouse" && e.button !== 0) return;
    geserRef.current = { id: e.pointerId, x0: e.clientX, x: e.clientX, ntaken: false };
  }

  function geserPanel(e: React.PointerEvent) {
    const g = geserRef.current;
    if (!g || g.id !== e.pointerId) return;
    g.x = e.clientX;
    const dx = e.clientX - g.x0;

    /*
     * Pointer capture baru diambil setelah jarak melebihi ambang, bukan di
     * pointerdown. Kalau diambil langsung, click pada tautan di dalam drawer
     * ikut dialihkan ke elemen panel dan tautannya tidak pernah aktif. Menunda
     * capture sampai jelas sedang menggeser membuat ketuk biasa tetap normal,
     * sedangkan setelah capture aktif, geser otomatis mengikuti jari walau
     * pointer-nya keluar dari panel.
     */
    if (!g.ntaken && Math.abs(dx) > AMBANG_GESER) {
      g.ntaken = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setTarik(true);
    }
    // Ke kanan dipotong di 0: panel tidak bisa ditarik keluar dari tepi layar.
    setGeserX(Math.min(0, dx));
  }

  function lepasGeser(e: React.PointerEvent) {
    const g = geserRef.current;
    if (!g || g.id !== e.pointerId) return;
    geserRef.current = null;
    if (!g.ntaken) return; // ketuk biasa, biarkan click-nya sendiri yang bekerja
    setTarik(false);

    const dx = g.x - g.x0;
    if (dx <= -AMBANG_TUTUP) tutup();
    else {
      // Snap balik terbuka: kembalikan geseran ke 0 dengan transisi hidup lagi.
      setGeserX(0);
    }
  }

  return (
    <>
      {/*
        App bar. Tombol hamburger tidak diberi teks label karena ikon tiga garis
        sudah jelas artinya menu, dan label cuma memenuhi ruang di layar sempit.
      */}
      <header className="sticky top-0 z-30 border-b border-aksen-gelap bg-aksen text-white shadow-sm">
        <div className="flex items-center gap-1 px-1 py-1.5">
          <button
            type="button"
            onClick={() => setTerbukaDi(pathname)}
            aria-label="Buka menu"
            className="grid h-11 w-11 place-items-center rounded-lg transition-colors hover:bg-white/10 active:bg-white/20"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <span className="truncate px-1 text-base font-semibold tracking-tight">Konveksi</span>
          <span className="flex-1" />
          <span className="max-w-28 truncate pr-2 text-xs text-white/75">{username}</span>
        </div>
      </header>

      {/* Area gelap di belakang panel: 40% hitam, sesuai permintaan. */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${
          buka ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={tutup}
        aria-hidden
      />

      <div
        className={`geser-panel fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-garis bg-permukaan shadow-xl ${
          tarik ? "tarik" : ""
        } ${buka ? "" : "pointer-events-none"}`}
        style={{
          transform: buka ? `translateX(${geserX}px)` : "translateX(-100%)",
        }}
        role="dialog"
        aria-modal={buka || undefined}
        aria-label="Menu navigasi"
        onPointerDown={mulaiGeser}
        onPointerMove={geserPanel}
        onPointerUp={lepasGeser}
        onPointerCancel={lepasGeser}
      >
        <div className="flex items-center gap-1 border-b border-aksen-gelap bg-aksen px-1 py-1.5 text-white">
          <button
            type="button"
            onClick={tutup}
            aria-label="Tutup menu"
            className="grid h-11 w-11 place-items-center rounded-lg transition-colors hover:bg-white/10 active:bg-white/20"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
          <span className="truncate px-1 text-base font-semibold tracking-tight">Konveksi</span>
        </div>

        <NavLinks onPilih={tutup} />

        <div className="border-t border-garis px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <p className="truncate text-xs text-teks-lembut">Masuk sebagai</p>
          <p className="mb-2 truncate text-sm font-medium">{username}</p>
          <LogoutButton />
        </div>
      </div>
    </>
  );
}