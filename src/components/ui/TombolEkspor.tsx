"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Button } from "./Button";
import { unduhTabelGambar, type DataEkspor } from "@/lib/ekspor-tabel";

/*
 * Tombol "Ekspor gambar" yang ditaruh di judul tiap tabel.
 *
 * Data dibentuk lewat callback `siapkan`, bukan prop objek langsung, supaya
 * isi gambar selalu mengikuti keadaan tabel saat tombol diklik — termasuk
 * filter yang sedang aktif dan baris yang sedang disaring oleh kotak cari.
 * Kalau datanya dikirim sebagai prop, ia di-capture saat render dan bisa
 * basi kalau ada perubahan state yang tidak ikut re-render tombol.
 */

const IKON = "M12 3v10m0 0 3.5-3.5M12 13 8.5 9.5M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2";

export default function TombolEkspor({
  siapkan,
  namaFile,
  children = "Ekspor gambar",
  className = "",
  ...rest
}: {
  siapkan: () => DataEkspor;
  namaFile?: string;
  children?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick">) {
  function jalan() {
    const data = siapkan();
    unduhTabelGambar(data, namaFile);
  }

  return (
    <Button variant="secondary" size="sm" className={className} onClick={jalan} {...rest}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden
      >
        <path d={IKON} />
      </svg>
      {children}
    </Button>
  );
}
