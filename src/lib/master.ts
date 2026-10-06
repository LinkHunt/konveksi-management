// Logika bersama untuk data master: whitelist entity, validasi, deteksi duplikat,
// dan pengecekan master yang masih dipakai transaksi.
//
// Whitelist eksplisit dipakai, bukan nama entity dari URL langsung dipakai
// sebagai nama model Prisma, supaya input tidak pernah jadi nama tabel.

import type { PrismaClient } from "@prisma/client";
import {
  MASTER_ENTITIES,
  masterPatchSchema,
  masterSchema,
  isMasterEntity,
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
  penjahit: "Penjahit",
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
 * Sudah ada master dengan nama sama? Huruf besar/kecil diabaikan tanpa mengubah
 * skema, lewat filter mode-insensitive PostgreSQL.
 */
export async function namaSudahDipakai(
  db: PrismaClient,
  entity: MasterEntity,
  nama: string,
  opts: { pemilikId?: number; excludeId?: number } = {},
): Promise<boolean> {
  const namaEq = { equals: nama, mode: "insensitive" as const };
  const bukanIni = opts.excludeId === undefined ? {} : { id: { not: opts.excludeId } };

  if (entity === "model") {
    const ada = await db.modelBaju.findFirst({
      where: { nama: namaEq, pemilikId: opts.pemilikId, ...bukanIni },
      select: { id: true },
    });
    return ada !== null;
  }
  if (entity === "pemilik") {
    return (await db.pemilik.findFirst({ where: { nama: namaEq, ...bukanIni } })) !== null;
  }
  if (entity === "warna") {
    return (await db.warna.findFirst({ where: { nama: namaEq, ...bukanIni } })) !== null;
  }
  return (await db.penjahit.findFirst({ where: { nama: namaEq, ...bukanIni } })) !== null;
}

export function pesanDuplikat(entity: MasterEntity, nama: string): string {
  return entity === "model"
    ? `Model "${nama}" untuk pemilik tersebut sudah ada.`
    : `${LABEL_ENTITY[entity]} "${nama}" sudah ada.`;
}

/** Jumlah transaksi yang masih merujuk master ini. */
export async function jumlahTransaksiMemakai(
  db: PrismaClient,
  entity: MasterEntity,
  id: number,
): Promise<number> {
  if (entity === "pemilik") {
    const models = await db.modelBaju.findMany({ where: { pemilikId: id }, select: { id: true } });
    if (models.length === 0) return 0;
    return db.transaksi.count({ where: { modelId: { in: models.map((m) => m.id) } } });
  }
  if (entity === "model") return db.transaksi.count({ where: { modelId: id } });
  // Warna tidak lagi ada di header transaksi, jadi dipakaiunya dicek lewat item.
  if (entity === "warna") return db.transaksiItem.count({ where: { warnaId: id } });
  return db.transaksi.count({ where: { penjahitId: id } });
}

/** Master yang dirujuk transaksi tidak boleh dinonaktifkan. */
export function masterSedangDipakai(entity: MasterEntity): string {
  return entity === "pemilik"
    ? "Pemilik masih dipakai model baju yang dipakai transaksi."
    : `${LABEL_ENTITY[entity]} masih dipakai transaksi yang sudah tercatat.`;
}

// ---- Akses data: satu fungsi per entity, tipe hasil pasti ----

const SELECT_BASIC = { id: true, nama: true, aktif: true } as const;
const SELECT_MODEL = {
  id: true,
  nama: true,
  aktif: true,
  pemilikId: true,
  pemilik: { select: { id: true, nama: true } },
} as const;

export type BarisBasic = { id: number; nama: string; aktif: boolean };
export type BarisModel = BarisBasic & { pemilikId: number; pemilik: { id: number; nama: string } };

export function ambil(db: PrismaClient, entity: MasterEntity, id: number): Promise<BarisBasic | BarisModel | null> {
  if (entity === "model") return db.modelBaju.findUnique({ where: { id }, select: SELECT_MODEL });
  if (entity === "pemilik") return db.pemilik.findUnique({ where: { id }, select: SELECT_BASIC });
  if (entity === "warna") return db.warna.findUnique({ where: { id }, select: SELECT_BASIC });
  return db.penjahit.findUnique({ where: { id }, select: SELECT_BASIC });
}

export function daftar(
  db: PrismaClient,
  entity: MasterEntity,
  where: { aktif?: boolean },
): Promise<BarisBasic[] | BarisModel[]> {
  if (entity === "model") {
    return db.modelBaju.findMany({ where, select: SELECT_MODEL, orderBy: { nama: "asc" } });
  }
  if (entity === "pemilik") return db.pemilik.findMany({ where, select: SELECT_BASIC, orderBy: { nama: "asc" } });
  if (entity === "warna") return db.warna.findMany({ where, select: SELECT_BASIC, orderBy: { nama: "asc" } });
  return db.penjahit.findMany({ where, select: SELECT_BASIC, orderBy: { nama: "asc" } });
}

export function buat(
  db: PrismaClient,
  entity: MasterEntity,
  body: MasterCreateBody,
): Promise<BarisBasic | BarisModel> {
  const aktif = (body as { aktif?: boolean }).aktif;
  const data = aktif === undefined ? {} : { aktif };
  if (entity === "model") {
    const b = body as { nama: string; pemilikId: number };
    return db.modelBaju.create({ data: { nama: b.nama, pemilikId: b.pemilikId, ...data }, select: SELECT_MODEL });
  }
  const n = (body as { nama: string }).nama;
  if (entity === "pemilik") return db.pemilik.create({ data: { nama: n, ...data }, select: SELECT_BASIC });
  if (entity === "warna") return db.warna.create({ data: { nama: n, ...data }, select: SELECT_BASIC });
  return db.penjahit.create({ data: { nama: n, ...data }, select: SELECT_BASIC });
}

export function ubah(
  db: PrismaClient,
  entity: MasterEntity,
  id: number,
  data: { nama?: string; aktif?: boolean; pemilikId?: number },
): Promise<BarisBasic | BarisModel> {
  if (entity === "model") return db.modelBaju.update({ where: { id }, data, select: SELECT_MODEL });
  if (entity === "pemilik") return db.pemilik.update({ where: { id }, data, select: SELECT_BASIC });
  if (entity === "warna") return db.warna.update({ where: { id }, data, select: SELECT_BASIC });
  return db.penjahit.update({ where: { id }, data, select: SELECT_BASIC });
}
