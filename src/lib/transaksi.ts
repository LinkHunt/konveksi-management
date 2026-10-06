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

export type ItemInput = { warnaId: number; ukuran: UkuranLabel; jumlah: number };

export type RowSiapSimpan = {
  tanggal: Date;
  jenis: Jenis;
  penjahitId: number;
  modelId: number;
  catatan: string | null;
  items: { warnaId: number; ukuran: UkuranEnum; jumlah: number }[];
  /** Nama warna per id, dipakai untuk pesan error dan pengurutan. */
  namaWarna: Map<number, string>;
};

/**
 * Ubah payload mentah (dari zod) jadi bentuk siap tulis:
 * tanggal jadi Date, ukuran jadi nama enum Prisma, item dengan jumlah 0 dibuang.
 *
 * Warna sudah harus ada di database pada saat ini, jadi nama-namanya diambil
 * dulu untuk dipakai pesan duplikat dan pengurutan. Warna yang tidak ada
 * ditolak di sini, sebelum cek master yang lain.
 */
export async function siapSimpan(payload: {
  tanggal: string;
  jenis: Jenis;
  penjahitId: number;
  modelId: number;
  catatan?: string | null;
  items: { warnaId: number; ukuran: string; jumlah: unknown }[];
}): Promise<RowSiapSimpan> {
  const db = getDb();
  const warnaIds = [...new Set(payload.items.map((i) => i.warnaId))];
  const warnaRows = await db.warna.findMany({
    where: { id: { in: warnaIds } },
    select: { id: true, nama: true },
  });
  const namaWarna = new Map(warnaRows.map((w) => [w.id, w.nama]));
  const hilang = warnaIds.filter((id) => !namaWarna.has(id));
  if (hilang.length > 0) {
    throw badRequest(`Warna tidak ditemukan: ${hilang.map((id) => `#${id}`).join(", ")}.`);
  }

  const items = normalisasiItems(payload.items, namaWarna).map((it) => ({
    warnaId: it.warnaId,
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
    catatan: payload.catatan?.trim() ? payload.catatan.trim() : null,
    items,
    namaWarna,
  };
}

/**
 * Pastikan penjahit, model, dan semua warna ada. Saat membuat, semuanya harus
 * aktif (beserta pemilik dari model). Saat PUT, master yang sudah nonaktif tetap
 * boleh dipakai selama nilainya tidak berubah, supaya koreksi transaksi lama
 * tidak tertolak hanya karena master-nya sudah dinonaktifkan.
 */
export async function pastikanMaster(
  ids: { penjahitId: number; modelId: number; warnaId: number[] },
  opts: { toleransiNonaktif: boolean } = { toleransiNonaktif: false },
): Promise<void> {
  const db = getDb();
  const [penjahit, model, warna] = await Promise.all([
    db.penjahit.findUnique({ where: { id: ids.penjahitId }, select: { id: true, aktif: true } }),
    db.modelBaju.findUnique({
      where: { id: ids.modelId },
      select: { id: true, aktif: true, pemilik: { select: { id: true, aktif: true } } },
    }),
    db.warna.findMany({ where: { id: { in: ids.warnaId } }, select: { id: true, nama: true, aktif: true } }),
  ]);

  if (!penjahit) throw badRequest("Penjahit tidak ditemukan.");
  if (!model) throw badRequest("Model baju tidak ditemukan.");
  if (warna.length !== new Set(ids.warnaId).size) {
    const ada = new Set(warna.map((w) => w.id));
    const hilang = [...new Set(ids.warnaId)].filter((id) => !ada.has(id));
    throw badRequest(`Warna tidak ditemukan: ${hilang.map((id) => `#${id}`).join(", ")}.`);
  }

  if (opts.toleransiNonaktif) return;

  if (!penjahit.aktif) throw badRequest("Penjahit yang dipilih sudah nonaktif.");
  if (!model.aktif) throw badRequest("Model baju yang dipilih sudah nonaktif.");
  if (!model.pemilik.aktif) throw badRequest("Pemilik dari model yang dipilih sudah nonaktif.");
  for (const w of warna) {
    if (!w.aktif) throw badRequest(`Warna ${w.nama} sudah nonaktif.`);
  }
}

export const SELECT_TRANSAKSI = {
  id: true,
  tanggal: true,
  jenis: true,
  catatan: true,
  createdAt: true,
  penjahit: { select: { id: true, nama: true } },
  model: { select: { id: true, nama: true, pemilik: { select: { id: true, nama: true } } } },
  items: { select: { warnaId: true, ukuran: true, jumlah: true, warna: { select: { nama: true } } } },
} as const satisfies Prisma.TransaksiSelect;

type BarisDariDb = Prisma.TransaksiGetPayload<{ select: typeof SELECT_TRANSAKSI }>;
export type BarisTransaksi = BarisDariDb;

/**
 * Serialisasi untuk API: tanggal YYYY-MM-DD, ukuran label asli, warna ikut
 * per item (bukan satu di header), plus total pcs.
 */
export function serialisasiTransaksi(t: BarisTransaksi) {
  const namaWarna = new Map(t.items.map((it) => [it.warnaId, it.warna.nama]));
  const items = urutItems(
    t.items.map((it) => ({
      warnaId: it.warnaId,
      ukuran: (toLabelUkuran(it.ukuran) ?? it.ukuran) as UkuranLabel,
      jumlah: it.jumlah,
    })),
    namaWarna,
  );
  return {
    id: t.id,
    tanggal: formatTanggalWIB(t.tanggal),
    jenis: t.jenis,
    catatan: t.catatan,
    penjahit: t.penjahit,
    pemilik: t.model.pemilik,
    model: { id: t.model.id, nama: t.model.nama },
    items: items.map((it) => ({ ...it, warna: { id: it.warnaId, nama: namaWarna.get(it.warnaId) ?? "" } })),
    totalPcs: items.reduce((s, i) => s + i.jumlah, 0),
  };
}

export { parseTanggalWIB, formatTanggalWIB };
