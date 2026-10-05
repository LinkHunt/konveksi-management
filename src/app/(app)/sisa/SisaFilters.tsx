"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Select } from "@/components/ui/Input";
import { Card } from "@/components/ui/Alert";

type Opsi = { id: number; nama: string };
export type FilterSisa = {
  penjahitId?: number;
  pemilikId?: number;
  modelId?: number;
  warnaId?: number;
};

/*
 * Filter ditulis ke URL query, bukan disimpan di state. Alasannya: server
 * component yang merender tabel sisa butuh tahu filter apa yang aktif, dan URL
 * adalah satu-satunya tempat yang shared antara client dan server. Efek
 * sampingnya bagus: filter bisa di-bookmark dan di-share.
 */
export default function SisaFilters({
  penjahit,
  pemilik,
  model,
  warna,
  awal,
  sembunyiNol,
}: {
  penjahit: Opsi[];
  pemilik: Opsi[];
  model: Opsi[];
  warna: Opsi[];
  awal: FilterSisa;
  sembunyiNol: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [sedangKirim, setSedangKirim] = useState(false);

  function terapkan(ubah: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(ubah)) {
      if (v === "") sp.delete(k);
      else sp.set(k, v);
    }
    setSedangKirim(true);
    router.replace(`/sisa${sp.size ? `?${sp}` : ""}`);
  }

  const OPSI: Record<keyof FilterSisa, Opsi[]> = {
    penjahitId: penjahit,
    pemilikId: pemilik,
    modelId: model,
    warnaId: warna,
  };

  const select = (kunci: keyof FilterSisa) => (
    <Select
      value={awal[kunci] ? String(awal[kunci]) : ""}
      onChange={(e) => terapkan({ [kunci]: e.target.value })}
      className={sedangKirim ? "opacity-60" : ""}
    >
      <option value="">Semua</option>
      {OPSI[kunci].map((o) => (
        <option key={o.id} value={o.id}>
          {o.nama}
        </option>
      ))}
    </Select>
  );

  const adaFilter = Boolean(awal.penjahitId || awal.pemilikId || awal.modelId || awal.warnaId);

  return (
    <Card className="mb-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-xs font-medium text-teks-lembut">Penjahit</span>
          {select("penjahitId")}
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-xs font-medium text-teks-lembut">Pemilik</span>
          {select("pemilikId")}
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-xs font-medium text-teks-lembut">Model</span>
          {select("modelId")}
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-xs font-medium text-teks-lembut">Warna</span>
          {select("warnaId")}
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-teks-lembut">
          <input
            type="checkbox"
            checked={!sembunyiNol}
            onChange={(e) => terapkan({ sembunyikanNol: e.target.checked ? "0" : "1" })}
            className="h-4 w-4 rounded border-garis-kuat accent-aksen"
          />
          Tampilkan sisa 0
        </label>
        {adaFilter ? (
          <button
            type="button"
            onClick={() => terapkan({ penjahitId: "", pemilikId: "", modelId: "", warnaId: "" })}
            className="text-sm text-aksen hover:underline"
          >
            Reset filter
          </button>
        ) : null}
      </div>
    </Card>
  );
}