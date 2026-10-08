"use client";

import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { hitungKurang, kotakKurang } from "@/lib/kurang";
import { daftar } from "@/lib/master";
import { Card, PageHeader } from "@/components/ui/Alert";
import KurangFilters, { type FilterKurang } from "./KurangFilters";
import KurangPanel from "./KurangPanel";

/*
 * Halaman kurang: hasil potongan dikurangi setoran, per model + warna + ukuran.
 * Filter ditulis ke hash query (pola yang sama dengan versi Next.js), lalu
 * data dibaca langsung dari database lokal sesuai filter.
 */
export default function KurangPage() {
  const [params] = useSearchParams();

  const data = useMemo(() => {
    const angka = (k: string): number | undefined => {
      const v = params.get(k);
      if (v === null) return undefined;
      const n = Number(v);
      return Number.isInteger(n) && n > 0 ? n : undefined;
    };
    // Default: tampilkan SEMUA kombinasi (termasuk yang sudah lunas), supaya
    // status "lunas" terlihat dan tidak bikin bingung. Checkbox di UI yang
    // menonaktifkannya.
    const sembunyiSelesai = params.get("sembunyikanSelesai") === "1";
    const filter: FilterKurang = {
      pemilikId: angka("pemilikId"),
      modelId: angka("modelId"),
      warnaId: angka("warnaId"),
    };

    const baris = hitungKurang(filter);
    const idNama = (rows: unknown[]) =>
      (rows as { id: number; nama: string }[]).map((r) => ({ id: r.id, nama: r.nama }));
    const pemilik = idNama(daftar("pemilik", {}));
    const model = idNama(daftar("model", {}));
    const warna = idNama(daftar("warna", {}));

    const kotak = kotakKurang(baris);
    const terlihat = sembunyiSelesai ? kotak.filter((k) => !k.selesai) : kotak;
    const totalKurang = terlihat.reduce((s, k) => s + k.total, 0);

    return { filter, sembunyiSelesai, pemilik, model, warna, terlihat, totalKurang };
  }, [params]);

  return (
    <>
      <PageHeader
        title="Belum di setorkan"
        description="Hasil potongan dikurangi setoran. Angka 0 berarti belum disetor untuk kombinasi itu."
      />
      <KurangFilters
        pemilik={data.pemilik}
        model={data.model}
        warna={data.warna}
        awal={data.filter}
        sembunyiSelesai={data.sembunyiSelesai}
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-teks-lembut">Total kurang</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{data.totalKurang}</p>
        </Card>
        <Card>
          <p className="text-sm text-teks-lembut">Warna</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {data.terlihat.filter((k) => !k.selesai).length}
          </p>
        </Card>
      </div>
      <KurangPanel awal={data.terlihat} />
    </>
  );
}