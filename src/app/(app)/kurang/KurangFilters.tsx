"use client";

import { useSearchParams } from "react-router-dom";
import { useState } from "react";
import { Select } from "@/components/ui/Input";
import { Card } from "@/components/ui/Alert";

type Opsi = { id: number; nama: string };

export type FilterKurang = {
  pemilikId?: number;
  modelId?: number;
  warnaId?: number;
};

/*
 * Filter ditulis ke URL hash query, bukan disimpan di state. HashRouter
 * (file://) masih mendukung query string di path hash, jadi pola yang sama
 * dengan versi Next.js tetap jalan: filter bisa dibagikan/di-bookmark.
 */
export default function KurangFilters({
  pemilik,
  model,
  warna,
  awal,
  sembunyiSelesai,
}: {
  pemilik: Opsi[];
  model: Opsi[];
  warna: Opsi[];
  awal: FilterKurang;
  sembunyiSelesai: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const [sedangKirim, setSedangKirim] = useState(false);

  function terapkan(ubah: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(ubah)) {
      if (v === "") sp.delete(k);
      else sp.set(k, v);
    }
    setSedangKirim(true);
    const qs = sp.toString();
    setParams(qs ? `?${qs}` : "");
  }

  const OPSI: Record<keyof FilterKurang, Opsi[]> = {
    pemilikId: pemilik,
    modelId: model,
    warnaId: warna,
  };

  const select = (kunci: keyof FilterKurang) => (
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

  const adaFilter = Boolean(awal.pemilikId || awal.modelId || awal.warnaId);

  return (
    <Card className="mb-5">
      <div className="grid gap-3 sm:grid-cols-3">
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
            checked={sembunyiSelesai}
            onChange={(e) => terapkan({ sembunyikanSelesai: e.target.checked ? "1" : "0" })}
            className="h-4 w-4 rounded border-garis-kuat accent-aksen"
          />
          Sembunyikan yang sudah selesai
        </label>
        {adaFilter ? (
          <button
            type="button"
            onClick={() => terapkan({ pemilikId: "", modelId: "", warnaId: "" })}
            className="text-sm text-aksen hover:underline"
          >
            Reset filter
          </button>
        ) : null}
      </div>
    </Card>
  );
}