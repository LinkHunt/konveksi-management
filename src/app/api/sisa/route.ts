// GET /api/sisa
//
// Sisa belum disetor per penjahit + boss + model + warna + ukuran.
// Dihitung di database, tidak disimpan.
//
// Query:
//   penjahitId, bossId, modelId, warnaId  -> filter opsional
//   sembunyikanNol=1                     -> buang baris sisa tepat 0 (default: ya)
//   sembunyikanNol=0                     -> tampilkan juga baris sisa tepat 0
//
// Sisa negatif TIDAK dipotong: nilai minus dikembalikan apa adanya dan barisnya
// dapat flag lebih: true.

import { getDb } from "@/lib/db";
import { handle, jsonOk } from "@/lib/api";
import { guardSession, intParam } from "@/lib/request";
import { kelompokkanPerPenjahit, hitungSisa, type FilterSisa } from "@/lib/sisa";

export async function GET(request: Request) {
  return handle(async () => {
    await guardSession();
    const url = new URL(request.url);

    const filter: FilterSisa = {};
    const penjahitId = intParam(url, "penjahitId", { min: 1 });
    if (penjahitId !== undefined) filter.penjahitId = penjahitId;
    const bossId = intParam(url, "bossId", { min: 1 });
    if (bossId !== undefined) filter.bossId = bossId;
    const modelId = intParam(url, "modelId", { min: 1 });
    if (modelId !== undefined) filter.modelId = modelId;
    const warnaId = intParam(url, "warnaId", { min: 1 });
    if (warnaId !== undefined) filter.warnaId = warnaId;

    // Default sembunyikan baris sisa tepat 0; sembunyikanNol=0 menampilkannya.
    const sembunyiNol = url.searchParams.get("sembunyikanNol") !== "0";

    const semuaBaris = await hitungSisa(getDb(), filter);
    const baris = sembunyiNol ? semuaBaris.filter((b) => b.sisa !== 0) : semuaBaris;
    const perPenjahit = kelompokkanPerPenjahit(baris);

    return jsonOk({
      data: perPenjahit,
      ringkasan: {
        jumlahPenjahit: perPenjahit.length,
        totalBahanKeluar: perPenjahit.reduce((s, g) => s + g.totalBahanKeluar, 0),
        totalSetoran: perPenjahit.reduce((s, g) => s + g.totalSetoran, 0),
        totalSisa: perPenjahit.reduce((s, g) => s + g.totalSisa, 0),
        adaLebih: perPenjahit.some((g) => g.adaLebih),
      },
    });
  });
}