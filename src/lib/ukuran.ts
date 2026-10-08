// Definisi ukuran baju untuk aplikasi offline (sql.js).
//
// Ukuran disimpan sebagai TEXT label asli ('XS'..'8L') di SQLite. Tidak ada
// mapping ke enum Prisma lagi (tumpukan Postgres sudah ditinggalkan), jadi
// cuma daftar label + cek keanggotaan + urut logis.

export const UKURAN_LIST = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "2L",
  "3L",
  "5L",
  "8L",
] as const;

export type UkuranLabel = (typeof UKURAN_LIST)[number];

export function isUkuranLabel(value: unknown): value is UkuranLabel {
  return typeof value === "string" && (UKURAN_LIST as readonly string[]).includes(value);
}

/** Label API ("2L") -> label SQLite (sama, "2L"). Dijaga untuk kompatibilitas. */
export function toEnumUkuran(label: string): string {
  const key = label.trim().toUpperCase();
  if (!isUkuranLabel(key)) {
    throw new UkuranTidakValidError(label);
  }
  return key;
}

/** Nilai dari DB -> label API. Nilai tak dikenal dilewati (null). */
export function toLabelUkuran(value: string): UkuranLabel | null {
  return isUkuranLabel(value) ? value : null;
}

export class UkuranTidakValidError extends Error {
  constructor(value: unknown) {
    super(`Ukuran tidak dikenal: ${String(value)}`);
    this.name = "UkuranTidakValidError";
  }
}