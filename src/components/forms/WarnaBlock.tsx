"use client";

import { NumberInput, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { UKURAN_LIST, type UkuranLabel } from "@/lib/ukuran";
import type { BarisBasic } from "@/lib/client-api";

/*
 * Satu blok warna: dropdown warna + grid 9 ukuran.
 *
 * Warna ada di level item, bukan level transaksi, jadi satu transaksi bisa punya
 * beberapa blok warna. Tiap warna punya jumlah sendiri per ukuran, jadi dua warna
 * boleh punya ukuran yang sama dengan jumlah berbeda.
 *
 * UKURAN_LIST diimpor dari server module (`@/lib/ukuran`) karena isinya cuma
 * konstanta murni tanpa akses database, jadi aman dipakai di komponen client.
 */

export type BarisUkuran = { ukuran: UkuranLabel; jumlah: string };
export type BlokWarna = { warnaId: string; baris: BarisUkuran[] };

export function kosongkan(): BarisUkuran[] {
  return UKURAN_LIST.map((ukuran) => ({ ukuran, jumlah: "" }));
}

/** Satu blok kosong, dipakai saat form dibuka tanpa data koreksi. */
export function blokBaru(): BlokWarna {
  return { warnaId: "", baris: kosongkan() };
}

export function kosongkanSemua(): BlokWarna[] {
  return [blokBaru()];
}

/** Total pcs dari semua blok warna. Baris kosong atau nol tidak dihitung. */
export function totalPcs(blok: BlokWarna[]): number {
  return blok.reduce(
    (s, b) => s + b.baris.reduce((x, y) => x + (Number.parseInt(y.jumlah, 10) || 0), 0),
    0,
  );
}

/** Total pcs satu blok warna saja, buat label di header blok. */
export function totalBlok(b: BlokWarna): number {
  return b.baris.reduce((s, x) => s + (Number.parseInt(x.jumlah, 10) || 0), 0);
}

export function setJumlahBlok(
  blok: BlokWarna[],
  index: number,
  ukuran: UkuranLabel,
  nilai: string,
): BlokWarna[] {
  // Cuma digit. Kalau user paste "12abc", "12" akan lolos parseInt diam-diam
  // dan "abc" hilang tanpa jejak. Buang sekalian biar yang tersimpan sama
  // dengan yang diketik.
  const bersih = nilai.replace(/[^0-9]/g, "");
  return blok.map((b, i) =>
    i === index
      ? { ...b, baris: b.baris.map((x) => (x.ukuran === ukuran ? { ...x, jumlah: bersih } : x)) }
      : b,
  );
}

export default function WarnaBlock({
  blok,
  semua,
  onUbah,
  onTambah,
  onHapus,
}: {
  blok: BlokWarna[];
  /** Master warna, sudah difilter sesuai mode tambah/koreksi. */
  semua: BarisBasic[];
  onUbah: (next: BlokWarna[]) => void;
  onTambah: () => void;
  onHapus: (index: number) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {blok.map((b, i) => {
        const nama = semua.find((w) => String(w.id) === b.warnaId)?.nama;
        const total = totalBlok(b);
        return (
          <section key={i} className="rounded-lg border border-garis bg-permukaan-2 p-3">
            <div className="mb-3 flex items-end gap-2">
              <div className="flex-1">
                <label
                  htmlFor={`warna-${i}`}
                  className="mb-1.5 block text-sm font-medium text-teks"
                >
                  Warna {i + 1}
                </label>
                <Select
                  id={`warna-${i}`}
                  value={b.warnaId}
                  onChange={(e) =>
                    onUbah(
                      blok.map((x, j) => (j === i ? { ...x, warnaId: e.target.value } : x)),
                    )
                  }
                  required
                >
                  <option value="">Pilih warna</option>
                  {semua.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.nama}
                      {w.aktif ? "" : " (nonaktif)"}
                    </option>
                  ))}
                </Select>
              </div>
              {total > 0 ? (
                <span className="pb-2.5 text-sm tabular-nums text-teks-lembut">
                  <span className="font-semibold text-teks">{total}</span> pcs
                </span>
              ) : null}
              {blok.length > 1 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mb-1 text-bahaya hover:bg-bahaya-lembut"
                  onClick={() => onHapus(i)}
                  aria-label={`Hapus blok warna ${nama ?? i + 1}`}
                >
                  Hapus
                </Button>
              ) : null}
            </div>

            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {b.baris.map((row) => (
                <label key={row.ukuran} className="flex flex-col gap-1">
                  <span className="text-center text-xs font-medium text-teks-lembet">
                    {row.ukuran}
                  </span>
                  <NumberInput
                    value={row.jumlah}
                    onChange={(e) => onUbah(setJumlahBlok(blok, i, row.ukuran, e.target.value))}
                    placeholder="0"
                    aria-label={`Jumlah ukuran ${row.ukuran}${nama ? ` warna ${nama}` : ""}`}
                    className="px-1 py-2"
                  />
                </label>
              ))}
            </div>
          </section>
        );
      })}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onTambah}>
          Tambah warna lain
        </Button>
        <p className="text-xs text-teks-lembet">
          Biarkan kosong ukuran yang tidak dipakai. Server membuang jumlah 0.
        </p>
      </div>
    </div>
  );
}
