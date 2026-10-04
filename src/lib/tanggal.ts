// Tanggal diperlakukan sebagai tanggal kalender zona Asia/Jakarta (WIB, UTC+7).
//
// Kolom `tanggal` di database bertipe DATE, jadi tidak ada konversi timezone sama
// sekali saat disimpan. Nilai tetap dikunci ke 12:00 UTC (19:00 WIB, tengah hari
// kalender WIB) sebagai pagar: kalau suatu saat kolomnya berubah jadi timestamptz,
// nilai ini tidak akan bergeser sehari di sisi UI.

const OFFSET_WIB_JAM = 7;

/** "YYYY-MM-DD" -> Date UTC tengah hari WIB. Return null bila format tidak valid. */
export function parseTanggalWIB(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const tahun = Number(m[1]);
  const bulan = Number(m[2]);
  const hari = Number(m[3]);
  if (bulan < 1 || bulan > 12) return null;
  if (hari < 1 || hari > 31) return null;
  // Pagar belt: noon UTC = 19:00 WIB tanggal yang sama.
  const d = new Date(Date.UTC(tahun, bulan - 1, hari, 12, 0, 0));
  // Tolak tanggal yang tidak benar-benar ada, mis. 2026-02-31.
  if (d.getUTCFullYear() !== tahun || d.getUTCMonth() !== bulan - 1 || d.getUTCDate() !== hari) {
    return null;
  }
  return d;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Date -> "YYYY-MM-DD" memakai offset WIB. */
export function formatTanggalWIB(d: Date): string {
  const shifted = new Date(d.getTime() + OFFSET_WIB_JAM * 3600_000);
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
}

/** Tanggal hari ini menurut kalender WIB. */
export function hariIniWIB(now: Date = new Date()): string {
  return formatTanggalWIB(now);
}