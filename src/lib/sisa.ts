// Query sisa belum disetor.
//
// sisa = SUM(BAHAN_KELUAR) - SUM(SETORAN), dikelompokkan per
// penjahit + pemilik + model + warna + ukuran.
//
// Dihitung di database dengan satu query agregasi (bukan menarik semua baris ke
// aplikasi), dan hasilnya TIDAK disimpan di tabel mana pun.
//
// Catatan penting:
// - Kolom `tanggal` dan enum `Ukuran` di Postgres menyimpan label asli ('2L'),
//   jadi query mentah bisa dibandingkan langsung ke label.
// - SUM() di driver HTTP Prisma bisa balik sebagai BigInt, jadi semua angka
//   konversi ke Number sebelum dikirim ke klien.
// - Sisa negatif TIDAK dipotong ke 0. Baris negatif dapat flag lebih: true
//   supaya UI bisa menandai kemungkinan salah input.

import type { PrismaClient } from "@prisma/client";
import { UKURAN_LIST, type UkuranLabel } from "./ukuran";

export type BarisSisa = {
  penjahitId: number;
  penjahitNama: string;
  pemilikId: number;
  pemilikNama: string;
  modelId: number;
  modelNama: string;
  warnaId: number;
  warnaNama: string;
  ukuran: UkuranLabel;
  bahanKeluar: number;
  setoran: number;
  sisa: number;
  lebih: boolean;
};

export type SisaPerPenjahit = {
  penjahit: { id: number; nama: string };
  baris: BarisSisa[];
  totalSisa: number;
  totalBahanKeluar: number;
  totalSetoran: number;
  adaLebih: boolean;
};

export type FilterSisa = {
  penjahitId?: number;
  pemilikId?: number;
  modelId?: number;
  warnaId?: number;
};

type RawRow = {
  penjahitId: number;
  penjahitNama: string;
  pemilikId: number;
  pemilikNama: string;
  modelId: number;
  modelNama: string;
  warnaId: number;
  warnaNama: string;
  ukuran: string;
  bahanKeluar: bigint | number | null;
  setoran: bigint | number | null;
};

function keNumber(v: bigint | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "bigint" ? Number(v) : v;
}

/**
 * Ambil semua agregat dalam satu query. Filter NULL dari SQL dijawab dengan
 * nilai 0, dan sisa negatif dibiarkan apa adanya.
 */
export async function hitungSisa(
  db: PrismaClient,
  filter: FilterSisa,
): Promise<BarisSisa[]> {
  // Filter opsional. Semua id integer, jadi aman disisipkan lewat tagged template
  // $queryRaw: Prisma memarameterikan sendiri, jadi input user tidak pernah ikut
  // dirangkai jadi SQL.
  const raw = (await db.$queryRaw`
    SELECT
      t."penjahitId"     AS "penjahitId",
      pj."nama"          AS "penjahitNama",
      m."pemilikId"      AS "pemilikId",
      b."nama"           AS "pemilikNama",
      t."modelId"        AS "modelId",
      m."nama"           AS "modelNama",
      ti."warnaId"       AS "warnaId",
      w."nama"           AS "warnaNama",
      ti."ukuran"::text  AS "ukuran",
      COALESCE(SUM(ti."jumlah") FILTER (WHERE t."jenis" = 'BAHAN_KELUAR'), 0) AS "bahanKeluar",
      COALESCE(SUM(ti."jumlah") FILTER (WHERE t."jenis" = 'SETORAN'), 0)      AS "setoran"
    FROM "Transaksi" t
    JOIN "TransaksiItem" ti ON ti."transaksiId" = t."id"
    JOIN "Penjahit" pj ON pj."id" = t."penjahitId"
    JOIN "ModelBaju" m ON m."id" = t."modelId"
    JOIN "Pemilik" b ON b."id" = m."pemilikId"
    JOIN "Warna" w ON w."id" = ti."warnaId"
    WHERE
      (${filter.penjahitId ?? null}::int IS NULL OR t."penjahitId" = ${filter.penjahitId ?? null})
      AND (${filter.pemilikId ?? null}::int IS NULL OR m."pemilikId" = ${filter.pemilikId ?? null})
      AND (${filter.modelId ?? null}::int IS NULL OR t."modelId" = ${filter.modelId ?? null})
      AND (${filter.warnaId ?? null}::int IS NULL OR ti."warnaId" = ${filter.warnaId ?? null})
    GROUP BY t."penjahitId", pj."nama", m."pemilikId", b."nama", t."modelId", m."nama",
             ti."warnaId", w."nama", ti."ukuran"
  `) as unknown as RawRow[];

  const orderUkuran = new Map<string, number>(UKURAN_LIST.map((u, i) => [u, i]));

  return raw
    .map((r) => {
      const bahan = keNumber(r.bahanKeluar);
      const setor = keNumber(r.setoran);
      const sisa = bahan - setor;
      // Postgres menyimpan label ukuran asli ('2L'), jadi tidak ada yang perlu
      // dipetakan keluar dari DB.
      const ukuran = r.ukuran as UkuranLabel;
      return {
        penjahitId: r.penjahitId,
        penjahitNama: r.penjahitNama,
        pemilikId: r.pemilikId,
        pemilikNama: r.pemilikNama,
        modelId: r.modelId,
        modelNama: r.modelNama,
        warnaId: r.warnaId,
        warnaNama: r.warnaNama,
        ukuran,
        bahanKeluar: bahan,
        setoran: setor,
        sisa,
        lebih: sisa < 0,
      } satisfies BarisSisa;
    })
    .sort((a, b) => {
      const na = a.penjahitNama.localeCompare(b.penjahitNama, "id");
      if (na !== 0) return na;
      const ba = a.pemilikNama.localeCompare(b.pemilikNama, "id");
      if (ba !== 0) return ba;
      const ma = a.modelNama.localeCompare(b.modelNama, "id");
      if (ma !== 0) return ma;
      const wa = a.warnaNama.localeCompare(b.warnaNama, "id");
      if (wa !== 0) return wa;
      return (orderUkuran.get(a.ukuran) ?? 99) - (orderUkuran.get(b.ukuran) ?? 99);
    });
}

/** Kelompokkan baris per penjahit + total. */
export function kelompokkanPerPenjahit(baris: BarisSisa[]): SisaPerPenjahit[] {
  const peta = new Map<number, SisaPerPenjahit>();
  for (const b of baris) {
    let g = peta.get(b.penjahitId);
    if (!g) {
      g = {
        penjahit: { id: b.penjahitId, nama: b.penjahitNama },
        baris: [],
        totalSisa: 0,
        totalBahanKeluar: 0,
        totalSetoran: 0,
        adaLebih: false,
      };
      peta.set(b.penjahitId, g);
    }
    g.baris.push(b);
    g.totalSisa += b.sisa;
    g.totalBahanKeluar += b.bahanKeluar;
    g.totalSetoran += b.setoran;
    if (b.lebih) g.adaLebih = true;
  }
  return [...peta.values()].sort((a, b) => a.penjahit.nama.localeCompare(b.penjahit.nama, "id"));
}
