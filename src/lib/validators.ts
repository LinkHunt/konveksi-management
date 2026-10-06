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
  pemilik: z.object({ nama: namaWajib, aktif: z.boolean().optional() }),
  warna: z.object({ nama: namaWajib, aktif: z.boolean().optional() }),
  penjahit: z.object({ nama: namaWajib, aktif: z.boolean().optional() }),
  model: z.object({
    nama: namaWajib,
    pemilikId: z.number({ message: "Pemilik wajib dipilih." }).int().positive("Pemilik tidak valid."),
    aktif: z.boolean().optional(),
  }),
} as const;

export type MasterEntity = keyof typeof masterSchema;

export const MASTER_ENTITIES: MasterEntity[] = ["pemilik", "model", "warna", "penjahit"];

export function isMasterEntity(value: string): value is MasterEntity {
  return (MASTER_ENTITIES as string[]).includes(value);
}

/** Field yang boleh diubah lewat PATCH. */
export const masterPatchSchema = {
  pemilik: z.object({ nama: namaWajib.optional(), aktif: z.boolean().optional() }),
  warna: z.object({ nama: namaWajib.optional(), aktif: z.boolean().optional() }),
  penjahit: z.object({ nama: namaWajib.optional(), aktif: z.boolean().optional() }),
  model: z.object({
    nama: namaWajib.optional(),
    pemilikId: z.number().int().positive("Pemilik tidak valid.").optional(),
    aktif: z.boolean().optional(),
  }),
} as const;

export const jenisTransaksiSchema = z.enum(["SETORAN", "BAHAN_KELUAR"]);

const itemSchema = z.object({
  warnaId: z.number({ message: "Warna wajib dipilih." }).int().positive("Warna tidak valid."),
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
  catatan: z.string().trim().max(500, "Catatan maksimal 500 karakter.").nullish(),
  items: z
    .array(itemSchema, { message: "Item wajib diisi." })
    .min(1, "Minimal satu baris warna dan ukuran dengan jumlah lebih dari 0.")
    .max(60, "Maksimal 60 baris warna dan ukuran per transaksi."),
});

export type TransaksiInput = z.infer<typeof transaksiSchema>;

/**
 * Bersihkan item: buang jumlah 0 / kosong / negatif / bukan integer bulat.
 * Sisa minimal 1 baris, dan kombinasi warna + ukuran tidak boleh sama dua kali
 * dalam satu transaksi. Ukuran yang sama BOLEH muncul asal warnanya beda,
 * karena satu pengambilan bahan bisa punya beberapa warna.
 */
export function normalisasiItems(
  items: { warnaId: number; ukuran: string; jumlah: unknown }[],
  namaWarna: Map<number, string>,
): { warnaId: number; ukuran: (typeof UKURAN_LIST)[number]; jumlah: number }[] {
  const hasil: { warnaId: number; ukuran: (typeof UKURAN_LIST)[number]; jumlah: number }[] = [];
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
    const kunci = `${it.warnaId}|${label}`;
    if (seen.has(kunci)) {
      const nama = namaWarna.get(it.warnaId) ?? `warna #${it.warnaId}`;
      throw badRequest(`${nama} ukuran ${label} muncul lebih dari sekali. Gabungkan jumlahnya jadi satu baris.`);
    }
    seen.add(kunci);
    hasil.push({ warnaId: it.warnaId, ukuran: label, jumlah });
  }
  if (hasil.length === 0) {
    throw badRequest("Minimal satu baris warna dan ukuran dengan jumlah lebih dari 0.");
  }
  return hasil;
}

/**
 * Urutkan item menurut warna, lalu ukuran logis (XS..8L). Urutan warna dipakai
 * nama warna supaya item dengan warna sama selalu berdekatan, karena zod
 * mempertahankan urutan payload dan urutannya tidak dijamin.
 */
export function urutItems<T extends { ukuran: string; warnaId: number }>(
  items: T[],
  namaWarna?: Map<number, string>,
): T[] {
  const order = new Map<string, number>(UKURAN_LIST.map((u, i) => [u, i]));
  const orderWarna = new Map<number, number>();
  if (namaWarna) {
    [...namaWarna.keys()]
      .sort((a, b) => (namaWarna.get(a) ?? "").localeCompare(namaWarna.get(b) ?? "", "id"))
      .forEach((id, i) => orderWarna.set(id, i));
  }
  return [...items].sort(
    (a, b) =>
      (orderWarna.get(a.warnaId) ?? 99) - (orderWarna.get(b.warnaId) ?? 99) ||
      (order.get(a.ukuran) ?? 99) - (order.get(b.ukuran) ?? 99),
  );
}
