// Query "kurang": hasil potongan dikurangi total setoran.
//
//   kurang = SUM(hasil potongan) - SUM(setoran) per model + warna + ukuran
//   Dihitung dengan satu query agregasi (bukan menarik semua baris).
//   Setoran tidak boleh melebihi potongan (diblokir saat simpan), jadi nilai
//   tidak pernah negatif pada data konsisten. Query tetap menandai nilai
//   negatif sebagai pengaman (`lebih`).
//
// Versi offline (sql.js): tidak ada Prisma, query ditulis SQL tangan.
// SQLite memakai COALESCE / SUM agak sama dengan Postgres di sini.

import { semua } from "./db";
import { toLabelUkuran, UKURAN_LIST, type UkuranLabel } from "./ukuran";

export type BarisKurang = {
  modelId: number;
  modelNama: string;
  pemilikId: number;
  pemilikNama: string;
  warnaId: number;
  warnaNama: string;
  ukuran: UkuranLabel;
  potong: number;
  setor: number;
  kurang: number;
  lebih: boolean;
};

export type FilterKurang = {
  pemilikId?: number;
  modelId?: number;
  warnaId?: number;
  /** true -> kombinasi yang kurangnya 0 di semua warna disembunyikan. */
  sembunyikanSelesai?: boolean;
  /** Setoran yang DIKECUALIKAN dari perhitungan setor (mode edit setoran). */
  setoranId?: number;
};

type RawRow = {
  modelId: number;
  modelNama: string;
  pemilikId: number;
  pemilikNama: string;
  warnaId: number;
  warnaNama: string;
  ukuran: string;
  potong: number | null;
  setor: number | null;
};

function keNumber(v: number | null | undefined): number {
  return v === null || v === undefined ? 0 : v;
}

const ORDER_UKURAN = UKURAN_LIST as readonly string[];

export function urutanUkuran(u: string): number {
  return ORDER_UKURAN.indexOf(u);
}

/**
 * Ambil agregat dalam satu query: hasil potong di-LEFT JOIN setoran (aggregated
 * per model+warna+ukuran), supaya tidak ada penggandaan potongan saat satu
 * kombinasi disetor lebih dari sekali.
 */
export function hitungKurang(filter: FilterKurang = {}): BarisKurang[] {
  // Filter untuk join potongan (alias hp / m / b / w) UNTUK hasil potong.
  const whereInduk: string[] = [];
  const paramsInduk: unknown[] = [];
  if (filter.pemilikId !== undefined) { whereInduk.push("m.pemilikId = ?"); paramsInduk.push(filter.pemilikId); }
  if (filter.modelId !== undefined) { whereInduk.push("hp.modelId = ?"); paramsInduk.push(filter.modelId); }
  if (filter.warnaId !== undefined) { whereInduk.push("hp.warnaId = ?"); paramsInduk.push(filter.warnaId); }
  const whereIndukSql = whereInduk.length ? `WHERE ${whereInduk.join(" AND ")}` : "";

  // Filter untuk subquery SETORAN (alias si). Pengecualian setoran dicek juga.
  const whereSub: string[] = [];
  const paramsSub: unknown[] = [];
  if (filter.pemilikId !== undefined) { whereSub.push("m2.pemilikId = ?"); paramsSub.push(filter.pemilikId); }
  if (filter.modelId !== undefined) { whereSub.push("si.modelId = ?"); paramsSub.push(filter.modelId); }
  if (filter.warnaId !== undefined) { whereSub.push("si.warnaId = ?"); paramsSub.push(filter.warnaId); }
  if (filter.setoranId !== undefined) { whereSub.push("si.setoranId != ?"); paramsSub.push(filter.setoranId); }
  const whereSubSql = whereSub.length ? `WHERE ${whereSub.join(" AND ")}` : "";

  const raw = semua<RawRow>(
    `
    SELECT
      m.id         AS modelId,
      m.nama       AS modelNama,
      p.id         AS pemilikId,
      p.nama       AS pemilikNama,
      hp.warnaId   AS warnaId,
      w.nama       AS warnaNama,
      hp.ukuran    AS ukuran,
      COALESCE(pg.total, 0) AS potong,
      COALESCE(so.total, 0) AS setor
    FROM HasilPotong hp
    JOIN ModelBaju m ON m.id = hp.modelId
    JOIN Pemilik p  ON p.id = m.pemilikId
    JOIN Warna w    ON w.id = hp.warnaId
    LEFT JOIN (
      SELECT modelId, warnaId, ukuran, SUM(jumlah) AS total
      FROM HasilPotong
      GROUP BY modelId, warnaId, ukuran
    ) pg
      ON pg.modelId = hp.modelId AND pg.warnaId = hp.warnaId AND pg.ukuran = hp.ukuran
    LEFT JOIN (
      SELECT si.modelId, si.warnaId, si.ukuran, SUM(si.jumlah) AS total
      FROM SetoranItem si
      JOIN ModelBaju m2 ON m2.id = si.modelId
      ${whereSubSql}
      GROUP BY si.modelId, si.warnaId, si.ukuran
    ) so
      ON so.modelId = hp.modelId AND so.warnaId = hp.warnaId AND so.ukuran = hp.ukuran
    ${whereIndukSql}
    ORDER BY p.nama, m.nama, w.nama
    `,
    [...paramsInduk, ...paramsSub],
  );

  const hasil: BarisKurang[] = raw.map((r) => {
    const potong = keNumber(r.potong);
    const setor = keNumber(r.setor);
    const kurang = potong - setor;
    return {
      modelId: r.modelId,
      modelNama: r.modelNama,
      pemilikId: r.pemilikId,
      pemilikNama: r.pemilikNama,
      warnaId: r.warnaId,
      warnaNama: r.warnaNama,
      ukuran: (toLabelUkuran(r.ukuran) ?? r.ukuran) as UkuranLabel,
      potong,
      setor,
      kurang: Math.max(kurang, 0),
      lebih: kurang < 0,
    };
  });

  return hasil.sort((a, b) => {
    const na = a.modelNama.localeCompare(b.modelNama, "id");
    if (na !== 0) return na;
    const wa = a.warnaNama.localeCompare(b.warnaNama, "id");
    if (wa !== 0) return wa;
    return urutanUkuran(a.ukuran) - urutanUkuran(b.ukuran);
  });
}

/** Kotak: per model + warna, ringkasan ukuran + total kurang. */
export type KotakKurang = {
  modelId: number;
  modelNama: string;
  pemilikId: number;
  pemilikNama: string;
  warnaId: number;
  warnaNama: string;
  ukuran: { label: UkuranLabel; kurang: number }[];
  total: number;
  selesai: boolean;
};

export function kotakKurang(baris: BarisKurang[]): KotakKurang[] {
  const peta = new Map<string, KotakKurang>();
  for (const b of baris) {
    const k = `${b.modelId}|${b.warnaId}`;
    let kotak = peta.get(k);
    if (!kotak) {
      kotak = {
        modelId: b.modelId,
        modelNama: b.modelNama,
        pemilikId: b.pemilikId,
        pemilikNama: b.pemilikNama,
        warnaId: b.warnaId,
        warnaNama: b.warnaNama,
        ukuran: [],
        total: 0,
        selesai: true,
      };
      peta.set(k, kotak);
    }
    kotak.ukuran.push({ label: b.ukuran, kurang: b.kurang });
    kotak.total += b.kurang;
    if (b.kurang > 0) kotak.selesai = false;
  }
  for (const k of peta.values()) {
    k.ukuran.sort((a, b) => urutanUkuran(a.label) - urutanUkuran(b.label));
  }
  return [...peta.values()].sort((a, b) => a.modelNama.localeCompare(b.modelNama, "id"));
}