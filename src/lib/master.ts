// Logika bersama untuk data master: whitelist entity, validasi, deteksi duplikat,
// dan pengecekan master yang masih dipakai transaksi.
//
// Versi offline (sql.js): tidak ada Prisma. Entity master yang tersisa hanya
// pemilik, model, dan warna — penjahit DIBUANG total, begitu juga catatan
// transaksi (BAHAN_KELUAR). Master dipakai hasil potong + setoran saja.
//
// Field `aktif` disimpan sebagai INTEGER 0/1 di SQLite; tipe boolean dijaga
// supaya UI tidak berubah.

import { semua, satu, jalankan, simpanDb } from "./db";
import { badRequest, notFound } from "./api";
import {
  MASTER_ENTITIES,
  isMasterEntity,
  masterSchema,
  masterPatchSchema,
  type MasterEntity,
} from "./validators";

export { MASTER_ENTITIES, isMasterEntity };
export type { MasterEntity };

/** Bentuk hasil validasi, dipisah supaya TS tidak membentuk union yang ambigu. */
export type MasterCreateBody =
  | { nama: string; aktif?: boolean }
  | { nama: string; pemilikId: number; aktif?: boolean };
export type MasterPatchBody =
  | { nama?: string; aktif?: boolean }
  | { nama?: string; pemilikId?: number; aktif?: boolean };

/** Nama entitas untuk pesan error. */
export const LABEL_ENTITY: Record<MasterEntity, string> = {
  pemilik: "Pemilik",
  model: "Model baju",
  warna: "Warna",
};

export function parseMasterCreate(entity: MasterEntity, body: unknown): MasterCreateBody {
  return masterSchema[entity].parse(body) as MasterCreateBody;
}

export function parseMasterPatch(entity: MasterEntity, body: unknown): MasterPatchBody {
  return masterPatchSchema[entity].parse(body) as MasterPatchBody;
}

export function hasPemilikId(b: MasterCreateBody | MasterPatchBody): b is { pemilikId?: number } {
  return "pemilikId" in b && b.pemilikId !== undefined;
}

export function getNama(b: MasterCreateBody | MasterPatchBody): string | undefined {
  return (b as { nama?: string }).nama;
}

/**
 * Sudah ada master dengan nama sama? Huruf besar/kecil diabaikan lewat
 * LOWER(), tanpa mengubah skema (Postgres dulu mode "insensitive").
 */
export function namaSudahDipakai(
  entity: MasterEntity,
  nama: string,
  opts: { pemilikId?: number; excludeId?: number } = {},
): boolean {
  const bukanIni = opts.excludeId === undefined ? "" : "AND id != ?";
  const params: unknown[] = [];
  if (opts.excludeId !== undefined) params.push(opts.excludeId);

  if (entity === "model") {
    const ada = satu<{ id: number }>(
      `SELECT id FROM ModelBaju
       WHERE LOWER(nama) = LOWER(?) AND pemilikId = ? ${bukanIni}`,
      [nama, opts.pemilikId, ...params],
    );
    return ada !== null;
  }
  const tabel = entity === "pemilik" ? "Pemilik" : "Warna";
  return (
    satu<{ id: number }>(`SELECT id FROM ${tabel} WHERE LOWER(nama) = LOWER(?) ${bukanIni}`, [
      nama,
      ...params,
    ]) !== null
  );
}

export function pesanDuplikat(entity: MasterEntity, nama: string): string {
  return entity === "model"
    ? `Model "${nama}" untuk pemilik tersebut sudah ada.`
    : `${LABEL_ENTITY[entity]} "${nama}" sudah ada.`;
}

/**
 * Jumlah catatan yang masih merujuk master ini — hasil potong maupun setoran.
 * Menonaktifkan master yang masih dipakai akan mengubah laporan tanpa jejak,
 * jadi ikut diblokir. (Catatan transaksi BAHAN_KELUAR sudah dibuang.)
 */
export function jumlahTransaksiMemakai(entity: MasterEntity, id: number): number {
  const hitung = (tabel: string, kolom: string): number => {
    const r = satu<{ total: number }>(
      `SELECT COUNT(*) AS total FROM ${tabel} WHERE ${kolom} = ?`,
      [id],
    );
    return r?.total ?? 0;
  };

  if (entity === "pemilik") {
    const models = semua<{ id: number }>(`SELECT id FROM ModelBaju WHERE pemilikId = ?`, [id]);
    if (models.length === 0) return 0;
    const inSql = models.map(() => "?").join(",");
    const ids = models.map((m) => m.id);
    const potong = satu<{ total: number }>(
      `SELECT COUNT(*) AS total FROM HasilPotong WHERE modelId IN (${inSql})`,
      ids,
    )?.total ?? 0;
    const setor = satu<{ total: number }>(
      `SELECT COUNT(*) AS total FROM SetoranItem WHERE modelId IN (${inSql})`,
      ids,
    )?.total ?? 0;
    return potong + setor;
  }
  if (entity === "model") {
    return hitung("HasilPotong", "modelId") + hitung("SetoranItem", "modelId");
  }
  // warna
  return hitung("HasilPotong", "warnaId") + hitung("SetoranItem", "warnaId");
}

/** Master yang masih dipakai catatan (hasil potong / setoran) tidak boleh dinonaktifkan. */
export function masterSedangDipakai(entity: MasterEntity): string {
  return entity === "pemilik"
    ? "Pemilik masih dipakai model baju yang dipakai hasil potong atau setoran."
    : `${LABEL_ENTITY[entity]} masih dipakai hasil potong atau setoran.`;
}

// ---- Akses data: satu fungsi per entity, tipe hasil pasti ----
// sql.js mengembalikan integer `aktif` (0/1); dikonversi ke boolean untuk UI.

export type BarisBasic = { id: number; nama: string; aktif: boolean };
export type BarisModel = BarisBasic & { pemilikId: number; pemilik: { id: number; nama: string } };

function basicDari(r: { id: number; nama: string; aktif: number }): BarisBasic {
  return { id: r.id, nama: r.nama, aktif: r.aktif === 1 };
}

export function ambil(entity: MasterEntity, id: number): BarisBasic | BarisModel | null {
  if (entity === "model") {
    const r = satu<{ id: number; nama: string; aktif: number; pemilikId: number; pemilikNama: string }>(
      `SELECT m.id, m.nama, m.aktif, m.pemilikId, p.nama AS pemilikNama
       FROM ModelBaju m JOIN Pemilik p ON p.id = m.pemilikId
       WHERE m.id = ?`,
      [id],
    );
    if (!r) return null;
    return {
      id: r.id,
      nama: r.nama,
      aktif: r.aktif === 1,
      pemilikId: r.pemilikId,
      pemilik: { id: r.pemilikId, nama: r.pemilikNama },
    };
  }
  const tabel = entity === "pemilik" ? "Pemilik" : "Warna";
  const r = satu<{ id: number; nama: string; aktif: number }>(
    `SELECT id, nama, aktif FROM ${tabel} WHERE id = ?`,
    [id],
  );
  return r === null ? null : basicDari(r);
}

export function daftar(
  entity: MasterEntity,
  where: { aktif?: boolean },
): (BarisBasic | BarisModel)[] {
  const aktifSql = where.aktif === undefined ? "" : "WHERE aktif = ?";
  const aktifParams = where.aktif === undefined ? [] : [where.aktif ? 1 : 0];

  if (entity === "model") {
    const rows = semua<{ id: number; nama: string; aktif: number; pemilikId: number; pemilikNama: string }>(
      `SELECT m.id, m.nama, m.aktif, m.pemilikId, p.nama AS pemilikNama
       FROM ModelBaju m JOIN Pemilik p ON p.id = m.pemilikId
       ${aktifSql}
       ORDER BY m.nama ASC`,
      aktifParams,
    );
    return rows.map((r) => ({
      id: r.id,
      nama: r.nama,
      aktif: r.aktif === 1,
      pemilikId: r.pemilikId,
      pemilik: { id: r.pemilikId, nama: r.pemilikNama },
    }));
  }
  const tabel = entity === "pemilik" ? "Pemilik" : "Warna";
  const rows = semua<{ id: number; nama: string; aktif: number }>(
    `SELECT id, nama, aktif FROM ${tabel} ${aktifSql} ORDER BY nama ASC`,
    aktifParams,
  );
  return rows.map(basicDari);
}

export async function buat(
  entity: MasterEntity,
  body: MasterCreateBody,
): Promise<BarisBasic | BarisModel> {
  const db = getDb();
  const aktif = ((body as { aktif?: boolean }).aktif === false ? 0 : 1) as 0 | 1;

  if (entity === "model") {
    const b = body as { nama: string; pemilikId: number };
    if (!satu(`SELECT id FROM Pemilik WHERE id = ?`, [b.pemilikId])) {
      throw badRequest("Pemilik tidak ditemukan.");
    }
    jalankan(`INSERT INTO ModelBaju (nama, pemilikId, aktif) VALUES (?, ?, ?)`, [
      b.nama,
      b.pemilikId,
      aktif,
    ]);
    await simpanDb();
    const id = lastId();
    return ambil(entity, id)!;
  }

  const n = (body as { nama: string }).nama;
  const tabel = entity === "pemilik" ? "Pemilik" : "Warna";
  jalankan(`INSERT INTO ${tabel} (nama, aktif) VALUES (?, ?)`, [n, aktif]);
  await simpanDb();
  return ambil(entity, lastId())!;
}

/** ID baris terakhir yang di-INSERT pada koneksi aktif (sql.js). */
function lastId(): number {
  return satu<{ id: number }>(`SELECT last_insert_rowid() AS id`)!.id;
}

export async function ubah(
  entity: MasterEntity,
  id: number,
  data: { nama?: string; aktif?: boolean; pemilikId?: number },
): Promise<BarisBasic | BarisModel> {
  const db = getDb();
  if (!ambil(entity, id)) throw notFound(`${LABEL_ENTITY[entity]} tidak ditemukan.`);

  if (entity === "model") {
    jalankan(
      `UPDATE ModelBaju SET nama = COALESCE(?, nama), pemilikId = COALESCE(?, pemilikId),
       aktif = CASE WHEN ? IS NULL THEN aktif ELSE ? END
       WHERE id = ?`,
      [data.nama ?? null, data.pemilikId ?? null,
       data.aktif === undefined ? null : data.aktif ? 1 : 0,
       data.aktif === undefined ? null : data.aktif ? 1 : 0,
       id],
    );
  } else {
    const tabel = entity === "pemilik" ? "Pemilik" : "Warna";
    jalankan(
      `UPDATE ${tabel} SET nama = COALESCE(?, nama),
       aktif = CASE WHEN ? IS NULL THEN aktif ELSE ? END
       WHERE id = ?`,
      [data.nama ?? null, data.aktif === undefined ? null : data.aktif ? 1 : 0,
       data.aktif === undefined ? null : data.aktif ? 1 : 0,
       id],
    );
  }
  await simpanDb();
  return ambil(entity, id)!;
}