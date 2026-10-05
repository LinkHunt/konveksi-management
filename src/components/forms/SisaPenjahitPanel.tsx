"use client";

import type { BarisSisa } from "@/lib/client-api";

/*
 * Panel "Sisa belum disetor" untuk form setoran.
 *
 * Isinya dari `/api/sisa?penjahitId=X`, jadi angkanya sama persis dengan yang
 * tampil di halaman Sisa. Tidak ada hitungan ulang di client.
 *
 * Satu baris = satu kombinasi model + warna + ukuran. Baris dengan sisa <= 0
 * disembunyikan: sisa 0 berarti sudah lunas, sisa negatif berarti lebih banyak
 * setoran daripada bahan keluar, dan dua-duanya bukan sesuatu yang bisa
 * disetor lagi.
 */

export type Kombinasi = {
  modelId: number;
  warnaId: number;
  modelNama: string;
  warnaNama: string;
  /** Baris sisa per ukuran, hanya yang positif. */
  ukuran: { label: string; sisa: number }[];
  total: number;
};

/** Gabung baris sisa mentah jadi satu entri per model + warna. */
export function kelompokkanSisa(baris: BarisSisa[]): Kombinasi[] {
  const peta = new Map<string, Kombinasi>();
  for (const b of baris) {
    if (b.sisa <= 0) continue;
    const kunci = `${b.modelId}-${b.warnaId}`;
    let k = peta.get(kunci);
    if (!k) {
      k = {
        modelId: b.modelId,
        warnaId: b.warnaId,
        modelNama: b.modelNama,
        warnaNama: b.warnaNama,
        ukuran: [],
        total: 0,
      };
      peta.set(kunci, k);
    }
    k.ukuran.push({ label: b.ukuran, sisa: b.sisa });
    k.total += b.sisa;
  }
  // Urutkan dari sisa paling gede: kombinasi itu paling mungkin yang ditunggu.
  return [...peta.values()].sort((a, b) => b.total - a.total);
}

export default function SisaPenjahitPanel({
  nama,
  kombinasi,
  terpilih,
  onPilih,
}: {
  nama: string;
  kombinasi: Kombinasi[];
  /** Kombinasi yang sedang terisi di form, kalau ada. */
  terpilih?: { modelId: number; warnaId: number };
  onPilih: (k: Kombinasi) => void;
}) {
  if (kombinasi.length === 0) {
    return (
      <Card>
        <h2 className="text-sm font-semibold">Sisa {nama}</h2>
        <p className="mt-2 text-sm text-teks-lembut">
          Tidak ada sisa. Semua bahan yang pernah diambil {nama} sudah dikembalikan.
        </p>
      </Card>
    );
  }

  const total = kombinasi.reduce((s, k) => s + k.total, 0);

  return (
    <Card>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold">Sisa {nama}</h2>
        <p className="text-sm text-teks-lembut">
          <span className="font-semibold tabular-nums text-teks">{total}</span> pcs belum disetor
        </p>
      </div>
      <p className="mb-3 text-xs text-teks-lembut">
        Ketuk satu baris untuk memakainya. Isi form akan terisi sendiri, tinggal ubah
        kalau yang dikembalikan tidak utuh.
      </p>

      <div className="flex flex-col gap-2">
        {kombinasi.map((k) => {
          const on = terpilih?.modelId === k.modelId && terpilih?.warnaId === k.warnaId;
          return (
            <button
              key={`${k.modelId}-${k.warnaId}`}
              type="button"
              onClick={() => onPilih(k)}
              aria-pressed={on}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                on
                  ? "border-aksen bg-aksen-lembut"
                  : "border-garis bg-permukaan hover:border-garis-kuat hover:bg-permukaan-2"
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-sm font-medium">
                  {k.modelNama} / {k.warnaNama}
                </span>
                <span className="text-sm tabular-nums text-teks-lembut">{k.total} pcs</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {k.ukuran.map((u) => (
                  <span
                    key={u.label}
                    className="rounded bg-permukaan-2 px-1.5 py-0.5 text-xs tabular-nums text-teks-lembut"
                  >
                    {u.label} <span className="font-semibold text-teks">{u.sisa}</span>
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/** Bungkus Card supaya file ini tidak perlu mengimpor dari ui/Alert dua kali. */
function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-xl border border-garis bg-permukaan p-4">{children}</section>;
}