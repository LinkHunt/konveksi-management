"use client";

import { NumberInput } from "@/components/ui/Input";

/*
 * Tabel input jumlah per ukuran.
 *
 * Sembilan ukuran (XS..8L) dalam grid 5 kolom. Di HP 5 kolom masih muat tanpa
 * geser ke samping, dan tiap kolom cukup lebar buat angka 3-4 digit.
 *
 * UKURAN_LIST diimpor dari server module (`@/lib/ukuran`) karena isinya cuma
 * konstanta murni tanpa akses database, jadi aman dipakai di komponen client.
 */

import { UKURAN_LIST, type UkuranLabel } from "@/lib/ukuran";

export type BarisUkuran = { ukuran: UkuranLabel; jumlah: string };

export function kosongkan(): BarisUkuran[] {
  return UKURAN_LIST.map((ukuran) => ({ ukuran, jumlah: "" }));
}

export function totalPcs(baris: BarisUkuran[]): number {
  return baris.reduce((s, b) => s + (Number.parseInt(b.jumlah, 10) || 0), 0);
}

export default function UkuranTable({
  baris,
  onChange,
}: {
  baris: BarisUkuran[];
  onChange: (next: BarisUkuran[]) => void;
}) {
  function setJumlah(ukuran: UkuranLabel, nilai: string) {
    // Cuma digit. Kalau user paste "12abc", "12" akan lolos parseInt diam-diam
    // dan "abc" hilang tanpa jejak. Buang sekalian biar yang tersimpan sama
    // dengan yang diketik.
    const bersih = nilai.replace(/[^0-9]/g, "");
    onChange(baris.map((b) => (b.ukuran === ukuran ? { ...b, jumlah: bersih } : b)));
  }

  return (
    <div>
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {baris.map((b) => (
          <label key={b.ukuran} className="flex flex-col gap-1">
            <span className="text-center text-xs font-medium text-teks-lembut">{b.ukuran}</span>
            <NumberInput
              value={b.jumlah}
              onChange={(e) => setJumlah(b.ukuran, e.target.value)}
              placeholder="0"
              aria-label={`Jumlah ukuran ${b.ukuran}`}
              className="px-1 py-2"
            />
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs text-teks-lembut">
        Biarkan kosong kalau ukuran itu tidak dipakai. Server membuang jumlah 0.
      </p>
    </div>
  );
}