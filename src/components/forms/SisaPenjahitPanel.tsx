"use client";

import type { BarisSisa } from "@/lib/client-api";

/*
 * Panel "Sisa belum disetor" untuk form setoran.
 *
 * Isinya dari `/api/sisa?penjahitId=X`, jadi angkanya sama persis dengan yang
 * tampil di halaman Sisa. Tidak ada hitungan ulang di client.
 *
 * Satu kartu = satu model, di dalamnya semua warna yang masih punya sisa.
 * Ini sengaja di level model, bukan warna: satu pengambilan bahan hampir selalu
 * beberapa warna sekaligus, jadi mengetuk satu kartu mengisi semua warnanya
 * sekaligus. Warna yang tidak jadi diambil tinggal dihapus bloknya.
 *
 * Baris dengan sisa <= 0 disembunyikan: sisa 0 berarti sudah lunas, sisa
 * negatif berarti lebih banyak setoran daripada bahan keluar, dan dua-duanya
 * bukan sesuatu yang bisa disetor lagi.
 */

export type WarnaSisa = {
  warnaId: number;
  warnaNama: string;
  /** Baris sisa per ukuran, hanya yang positif. */
  ukuran: { label: string; sisa: number }[];
  total: number;
};

export type Kombinasi = {
  modelId: number;
  modelNama: string;
  warna: WarnaSisa[];
  total: number;
};

/**
 * Gabung baris sisa mentah jadi satu entri per model, warna dikumpulkan di
 * dalamnya. Baris sisa <= 0 dibuang, jadi hasilnya hanya yang bisa disetor.
 */
export function kelompokkanSisa(baris: BarisSisa[]): Kombinasi[] {
  const peta = new Map<number, Kombinasi>();
  const petaWarna = new Map<string, WarnaSisa>();
  for (const b of baris) {
    if (b.sisa <= 0) continue;
    let k = peta.get(b.modelId);
    if (!k) {
      k = { modelId: b.modelId, modelNama: b.modelNama, warna: [], total: 0 };
      peta.set(b.modelId, k);
    }
    const kunciWarna = `${b.modelId}-${b.warnaId}`;
    let w = petaWarna.get(kunciWarna);
    if (!w) {
      w = { warnaId: b.warnaId, warnaNama: b.warnaNama, ukuran: [], total: 0 };
      petaWarna.set(kunciWarna, w);
      k.warna.push(w);
    }
    w.ukuran.push({ label: b.ukuran, sisa: b.sisa });
    w.total += b.sisa;
    k.total += b.sisa;
  }
  // Warna paling gede dulu di dalam model, model paling gede dulu di daftar:
  // kombinasi itu paling mungkin yang ditunggu penjahit.
  return [...peta.values()]
    .map((k) => ({ ...k, warna: k.warna.sort((a, b) => b.total - a.total) }))
    .sort((a, b) => b.total - a.total);
}

/** Warna yang sama persis dengan isi form, buat menandai kartu aktif. */
export function samaDenganForm(k: Kombinasi, terpilih: { modelId: number; warnaId: number[] }) {
  if (terpilih.modelId !== k.modelId) return false;
  if (terpilih.warnaId.length !== k.warna.length) return false;
  return k.warna.every((w) => terpilih.warnaId.includes(w.warnaId));
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
  terpilih?: { modelId: number; warnaId: number[] };
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
        Ketuk satu kartu untuk memakainya. Semua warna di dalamnya ikut terisi, tinggal
        ubah kalau yang dikembalikan tidak utuh.
      </p>

      <div className="flex flex-col gap-2">
        {kombinasi.map((k) => {
          const on = terpilih !== undefined && samaDenganForm(k, terpilih);
          return (
            <button
              key={k.modelId}
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
                <span className="text-sm font-medium">{k.modelNama}</span>
                <span className="text-sm tabular-nums text-teks-lembut">{k.total} pcs</span>
              </div>

              <div className="mt-2 flex flex-col gap-1.5">
                {k.warna.map((w) => (
                  <div key={w.warnaId} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-xs text-teks-lembut">
                      {w.warnaNama} <span className="tabular-nums">({w.total})</span>
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      {w.ukuran.map((u) => (
                        <span
                          key={u.label}
                          className="rounded bg-permukaan-2 px-1.5 py-0.5 text-xs tabular-nums text-teks-lembut"
                        >
                          {u.label} <span className="font-semibold text-teks">{u.sisa}</span>
                        </span>
                      ))}
                    </span>
                  </div>
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
