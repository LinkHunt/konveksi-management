// Skema validasi request. Semua pesan dalam bahasa Indonesia supaya bisa
// ditampilkan langsung di UI.

import { z } from "zod";
import { UKURAN_LIST, isUkuranLabel } from "./ukuran";
import { badRequest } from "./api";

/** Nama wajib: ada, bukan cuma spasi, panjang wajar. */
const namaWajib = z
  .string({ message: "Nama wajib diisi." })
  .trim()
  .min(1, "Nama wajib diisi.")
  .max(120, "Nama maksimal 120 karakter.");

export const masterSchema = {
  boss: z.object({ nama: namaWajib, aktif: z.boolean().optional() }),
  warna: z.object({ nama: namaWajib, aktif: z.boolean().optional() }),
  penjahit: z.object({ nama: namaWajib, aktif: z.boolean().optional() }),
  model: z.object({
    nama: namaWajib,
    bossId: z.number({ message: "Boss wajib dipilih." }).int().positive("Boss tidak valid."),
    aktif: z.boolean().optional(),
  }),
} as const;

export type MasterEntity = keyof typeof masterSchema;

export const MASTER_ENTITIES: MasterEntity[] = ["boss", "model", "warna", "penjahit"];

export function isMasterEntity(value: string): value is MasterEntity {
  return (MASTER_ENTITIES as string[]).includes(value);
}

/** Field yang boleh diubah lewat PATCH. */
export const masterPatchSchema = {
  boss: z.object({ nama: namaWajib.optional(), aktif: z.boolean().optional() }),
  warna: z.object({ nama: namaWajib.optional(), aktif: z.boolean().optional() }),
  penjahit: z.object({ nama: namaWajib.optional(), aktif: z.boolean().optional() }),
  model: z.object({
    nama: namaWajib.optional(),
    bossId: z.number().int().positive("Boss tidak valid.").optional(),
    aktif: z.boolean().optional(),
  }),
} as const;

export const jenisTransaksiSchema = z.enum(["SETORAN", "BAHAN_KELUAR"]);

const itemSchema = z.object({
  ukuran: z.enum(UKURAN_LIST, {
    message: `Ukuran harus salah satu dari: ${UKURAN_LIST.join(", ")}.`,
  }),
  jumlah: z.number({ message: "Jumlah harus angka." }),
});

export const transaksiSchema = z.object({
  tanggal: z
    .string({ message: "Tanggal wajib diisi." })
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus format YYYY-MM-DD."),
  jenis: jenisTransaksiSchema,
  penjahitId: z.number({ message: "Penjahit wajib dipilih." }).int().positive("Penjahit tidak valid."),
  modelId: z.number({ message: "Model wajib dipilih." }).int().positive("Model tidak valid."),
  warnaId: z.number({ message: "Warna wajib dipilih." }).int().positive("Warna tidak valid."),
  catatan: z.string().trim().max(500, "Catatan maksimal 500 karakter.").nullish(),
  items: z
    .array(itemSchema, { message: "Item wajib diisi." })
    .min(1, "Minimal satu baris ukuran dengan jumlah lebih dari 0.")
    .max(20, "Maksimal 20 baris ukuran per transaksi."),
});

export type TransaksiInput = z.infer<typeof transaksiSchema>;

/**
 * Bersihkan item: buang jumlah 0 / kosong / negatif / bukan integer bulat.
 * Sisa minimal 1 baris, dan ukuran tidak boleh ganda.
 */
export function normalisasiItems(
  items: { ukuran: string; jumlah: unknown }[],
): { ukuran: (typeof UKURAN_LIST)[number]; jumlah: number }[] {
  const hasil: { ukuran: (typeof UKURAN_LIST)[number]; jumlah: number }[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const jumlah = typeof it.jumlah === "number" ? it.jumlah : Number(it.jumlah);
    if (!Number.isFinite(jumlah)) continue;
    if (!Number.isInteger(jumlah)) continue;
    if (jumlah <= 0) continue; // jumlah 0 / negatif dibuang
    const label = String(it.ukuran).trim().toUpperCase();
    if (!isUkuranLabel(label)) {
      throw badRequest(`Ukuran tidak dikenal: ${label}. Gunakan: ${UKURAN_LIST.join(", ")}.`);
    }
    if (seen.has(label)) {
      throw badRequest(`Ukuran ${label} muncul lebih dari sekali.`);
    }
    seen.add(label);
    hasil.push({ ukuran: label, jumlah });
  }
  if (hasil.length === 0) {
    throw badRequest("Minimal satu baris ukuran dengan jumlah lebih dari 0.");
  }
  return hasil;
}

/** Urutkan item menurut urutan ukuran logis (XS..8L). */
export function urutItems<T extends { ukuran: string }>(items: T[]): T[] {
  const order = new Map<string, number>(UKURAN_LIST.map((u, i) => [u, i]));
  return [...items].sort((a, b) => (order.get(a.ukuran) ?? 99) - (order.get(b.ukuran) ?? 99));
}