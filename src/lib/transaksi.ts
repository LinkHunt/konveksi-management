// Logika bersama untuk transaksi: validasi master, pemetaan ukuran, dan
// serialisasi respons.
//
// Ukuran memakai label asli di API (2L), nama enum Prisma di kode (L2).
// Postgres menyimpan label asli, jadi query mentah bisa dibandingkan langsung.

import type { Prisma, Ukuran as UkuranEnum } from "@prisma/client";
import { getDb } from "./db";
import { toEnumUkuran, toLabelUkuran, type UkuranLabel } from "./ukuran";
import { badRequest } from "./api";
import { normalisasiItems, urutItems } from "./validators";
import { parseTanggalWIB, formatTanggalWIB } from "./tanggal";

export type Jenis = "SETORAN" | "BAHAN_KELUAR";

export type ItemInput = { ukuran: UkuranLabel; jumlah: number };

export type RowSiapSimpan = {
  tanggal: Date;
  jenis: Jenis;
  penjahitId: number;
  modelId: number;
  warnaId: number;
  catatan: string | null;
  items: { ukuran: UkuranEnum; jumlah: number }[];
};

/**
 * Ubah payload mentah (dari zod) jadi bentuk siap tulis:
 * tanggal jadi Date, ukuran jadi nama enum Prisma, item dengan jumlah 0 dibuang.
 */
export function siapSimpan(payload: {
  tanggal: string;
  jenis: Jenis;
  penjahitId: number;
  modelId: number;
  warnaId: number;
  catatan?: string | null;
  items: { ukuran: string; jumlah: unknown }[];
}): RowSiapSimpan {
  const items = normalisasiItems(payload.items).map((it) => ({
    // toEnumUkuran mengembalikan literal label yang narrower dari enum Prisma,
    // jadi butuh cast di sini.
    ukuran: toEnumUkuran(it.ukuran) as unknown as UkuranEnum,
    jumlah: it.jumlah,
  }));

  const tanggal = parseTanggalWIB(payload.tanggal);
  if (!tanggal) throw badRequest("Tanggal tidak valid. Gunakan format YYYY-MM-DD.");

  return {
    tanggal,
    jenis: payload.jenis,
    penjahitId: payload.penjahitId,
    modelId: payload.modelId,
    warnaId: payload.warnaId,
    catatan: payload.catatan?.trim() ? payload.catatan.trim() : null,
    items,
  };
}

/**
 * Pastikan penjahit, model, warna ada. Saat membuat, semuanya harus aktif
 * (beserta boss dari model). Saat PUT, master yang sudah nonaktif tetap boleh
 * dipakai selama nilainya tidak berubah, supaya koreksi transaksi lama tidak
 * tertolak hanya karena master-nya sudah dinonaktifkan.
 */
export async function pastikanMaster(
  ids: { penjahitId: number; modelId: number; warnaId: number },
  opts: { toleransiNonaktif: boolean } = { toleransiNonaktif: false },
): Promise<void> {
  const db = getDb();
  const [penjahit, model, warna] = await Promise.all([
    db.penjahit.findUnique({ where: { id: ids.penjahitId }, select: { id: true, aktif: true } }),
    db.modelBaju.findUnique({
      where: { id: ids.modelId },
      select: { id: true, aktif: true, boss: { select: { id: true, aktif: true } } },
    }),
    db.warna.findUnique({ where: { id: ids.warnaId }, select: { id: true, aktif: true } }),
  ]);

  if (!penjahit) throw badRequest("Penjahit tidak ditemukan.");
  if (!model) throw badRequest("Model baju tidak ditemukan.");
  if (!warna) throw badRequest("Warna tidak ditemukan.");

  if (opts.toleransiNonaktif) return;

  if (!penjahit.aktif) throw badRequest("Penjahit yang dipilih sudah nonaktif.");
  if (!model.aktif) throw badRequest("Model baju yang dipilih sudah nonaktif.");
  if (!warna.aktif) throw badRequest("Warna yang dipilih sudah nonaktif.");
  if (!model.boss.aktif) throw badRequest("Boss dari model yang dipilih sudah nonaktif.");
}

export const SELECT_TRANSAKSI = {
  id: true,
  tanggal: true,
  jenis: true,
  catatan: true,
  createdAt: true,
  penjahit: { select: { id: true, nama: true } },
  model: { select: { id: true, nama: true, boss: { select: { id: true, nama: true } } } },
  warna: { select: { id: true, nama: true } },
  items: { select: { ukuran: true, jumlah: true } },
} as const satisfies Prisma.TransaksiSelect;

type BarisDariDb = Prisma.TransaksiGetPayload<{ select: typeof SELECT_TRANSAKSI }>;
export type BarisTransaksi = BarisDariDb;

/** Serialisasi untuk API: tanggal YYYY-MM-DD, ukuran label asli, plus total pcs. */
export function serialisasiTransaksi(t: BarisTransaksi) {
  const items = urutItems(
    t.items.map((it) => ({
      ukuran: (toLabelUkuran(it.ukuran) ?? it.ukuran) as UkuranLabel,
      jumlah: it.jumlah,
    })),
  );
  return {
    id: t.id,
    tanggal: formatTanggalWIB(t.tanggal),
    jenis: t.jenis,
    catatan: t.catatan,
    penjahit: t.penjahit,
    boss: t.model.boss,
    model: { id: t.model.id, nama: t.model.nama },
    warna: t.warna,
    items,
    totalPcs: items.reduce((s, i) => s + i.jumlah, 0),
  };
}

export { parseTanggalWIB, formatTanggalWIB };