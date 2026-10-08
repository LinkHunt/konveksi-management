"use client";

import { useMemo } from "react";
import { daftarSetoran } from "@/lib/setoran";
import { daftar } from "@/lib/master";
import { PageHeader } from "@/components/ui/Alert";
import SetoranPanel from "./SetoranPanel";

/*
 * Setoran ke atasan. Menampilkan riwayat setoran + form mencatat setoran baru,
 * dengan sisa target per model + warna + ukuran yang berasal dari hasil potong
 * (sumber data yang benar). Data dibaca langsung dari database lokal.
 */
export default function SetoranPage() {
  const { model, warna, setoran } = useMemo(() => {
    return {
      model: daftar("model", {}),
      warna: daftar("warna", {}),
      setoran: daftarSetoran({ limit: 30 }),
    };
  }, []);

  return (
    <>
      <PageHeader
        title="Setoran"
        description="Setoran hasil jahitan ke atasan. Setoran tidak boleh melebihi hasil potongan."
      />
      <SetoranPanel
        modelAwal={model as { id: number; nama: string; pemilikId: number; pemilik: { id: number; nama: string } }[]}
        warnaAwal={warna as { id: number; nama: string; aktif: boolean }[]}
        setoranAwal={setoran}
      />
    </>
  );
}