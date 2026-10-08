"use client";

import { useMemo } from "react";
import { getDb } from "@/lib/db";
import { daftarHasilPotong } from "@/lib/hasil-potong";
import { daftar } from "@/lib/master";
import { PageHeader } from "@/components/ui/Alert";
import HasilPotongPanel from "./HasilPotongPanel";

/*
 * Halaman hasil potong: sumber data yang benar untuk setoran. Menampilkan
 * daftar per model (pemilik, total, rincian warna + ukuran) dan form untuk
 * mencatat hasil potongan baru (isi sekaligus per model + warna + ukuran).
 *
 * Data dibaca langsung dari database lokal lewat lib (bukan API server).
 */
export default function HasilPotongPage() {
  const data = useMemo(() => {
    const db = getDb();
    return {
      model: daftar(db, "model", {}),
      warna: daftar(db, "warna", {}),
      hasil: daftarHasilPotong(db, {}),
    };
  }, []);

  return (
    <>
      <PageHeader
        title="Hasil Potong"
        description="Catatan hasil potongan per model, warna, dan ukuran. Ini sumber data yang benar — setoran dibatasi dari angka ini."
      />
      <HasilPotongPanel
        awal={data.hasil}
        modelAwal={
          data.model as {
            id: number;
            nama: string;
            pemilikId: number;
            pemilik: { id: number; nama: string };
          }[]
        }
        warnaAwal={data.warna as { id: number; nama: string; aktif: boolean }[]}
      />
    </>
  );
}