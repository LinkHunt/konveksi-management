"use client";

import { useState } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Button } from "./Button";
import { unduhTabelGambar, type DataEkspor } from "@/lib/ekspor-tabel";

const IKON = "M12 3v10m0 0 3.5-3.5M12 13 8.5 9.5M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2";

function pesanError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

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
  const [sedang, setSedang] = useState(false);

  async function jalan() {
    setSedang(true);
    try {
      const data = siapkan();
      await unduhTabelGambar(data, namaFile);
    } catch (err) {
      alert(pesanError(err));
    } finally {
      setSedang(false);
    }
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      className={className}
      onClick={jalan}
      disabled={sedang}
      {...rest}
    >
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
      {sedang ? "Menyiapkan..." : children}
    </Button>
  );
}
