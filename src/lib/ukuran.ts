// Satu-satunya tempat mapping antara label ukuran di API dan nama enum Prisma.
//
// Nama enum Prisma tidak boleh diawali angka, jadi 2L/3L/5L/8L dipetakan lewat
// @map menjadi L2/L3/L5/L8 di kode. Postgres sendiri tetap menyimpan label
// asli ('2L'), sehingga query mentah bisa dibandingkan langsung ke label.
//
// API selalu memakai label asli (XS, S, M, L, XL, 2L, 3L, 5L, 8L). Nama enum
// internal tidak boleh bocor ke klien.

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

const LABEL_TO_ENUM: Record<UkuranLabel, string> = {
  XS: "XS",
  S: "S",
  M: "M",
  L: "L",
  XL: "XL",
  "2L": "L2",
  "3L": "L3",
  "5L": "L5",
  "8L": "L8",
};

const ENUM_TO_LABEL: Record<string, UkuranLabel> = Object.fromEntries(
  Object.entries(LABEL_TO_ENUM).map(([label, enom]) => [enom, label as UkuranLabel]),
);

export function isUkuranLabel(value: unknown): value is UkuranLabel {
  return typeof value === "string" && value in LABEL_TO_ENUM;
}

/** Label API ("2L") -> nama enum Prisma ("L2"). Menyusun ulang input agar tidak ambigu. */
export function toEnumUkuran(label: string): UkuranLabel {
  const key = label.trim().toUpperCase();
  if (!isUkuranLabel(key)) {
    throw new UkuranTidakValidError(label);
  }
  return key;
}

/** Nama enum Prisma ("L2") -> label API ("2L"). Nilai tak dikenal dilewati. */
export function toLabelUkuran(enumName: string): UkuranLabel | null {
  return ENUM_TO_LABEL[enumName] ?? null;
}

export class UkuranTidakValidError extends Error {
  constructor(value: unknown) {
    super(`Ukuran tidak dikenal: ${String(value)}`);
    this.name = "UkuranTidakValidError";
  }
}