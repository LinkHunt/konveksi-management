// GET    /api/transaksi/{id} -> detail
// PUT    /api/transaksi/{id} -> ganti isi transaksi (seluruh item diganti)
// DELETE /api/transaksi/{id} -> hapus transaksi beserta itemnya (koreksi salah input)

import { getDb } from "@/lib/db";
import { handle, jsonOk, notFound, badRequest } from "@/lib/api";
import { guardMutation, guardSession, readJson } from "@/lib/request";
import { transaksiSchema } from "@/lib/validators";
import {
  SELECT_TRANSAKSI,
  pastikanMaster,
  serialisasiTransaksi,
  siapSimpan,
} from "@/lib/transaksi";

type Ctx = { params: Promise<{ id: string }> };

async function parseId(params: Promise<{ id: string }>): Promise<number> {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Id tidak valid.");
  return id;
}

export async function GET(_request: Request, { params }: Ctx) {
  return handle(async () => {
    await guardSession();
    const id = await parseId(params);
    const row = await getDb().transaksi.findUnique({ where: { id }, select: SELECT_TRANSAKSI });
    if (!row) throw notFound("Transaksi tidak ditemukan.");
    return jsonOk({ data: serialisasiTransaksi(row) });
  });
}

export async function PUT(request: Request, { params }: Ctx) {
  return handle(async () => {
    await guardMutation(request);
    const id = await parseId(params);
    const body = transaksiSchema.parse(await readJson(request));
    const row = await siapSimpan(body);

    const db = getDb();
    const lama = await db.transaksi.findUnique({
      where: { id },
      select: { penjahitId: true, modelId: true, items: { select: { warnaId: true } } },
    });
    if (!lama) throw notFound("Transaksi tidak ditemukan.");

    const warnaBaru = [...new Set(row.items.map((i) => i.warnaId))];
    const warnaLama = [...new Set(lama.items.map((i) => i.warnaId))];

    // Master nonaktif hanya boleh tetap dipakai kalau nilai master-nya tidak
    // berubah. Kalau pemakai menukar ke master lain, master baru harus aktif.
    const berubahPenjahit = lama.penjahitId !== row.penjahitId;
    const berubahModel = lama.modelId !== row.modelId;
    const warnaBaruMuncul =
      warnaBaru.some((w) => !warnaLama.includes(w)) || warnaBaru.length !== warnaLama.length;

    const target = { penjahitId: row.penjahitId, modelId: row.modelId, warnaId: warnaBaru };
    if (berubahPenjahit || berubahModel || warnaBaruMuncul) {
      await pastikanMaster(target, { toleransiNonaktif: false });
    } else {
      await pastikanMaster(target, { toleransiNonaktif: true });
    }

    // Ganti header + seluruh item dalam satu transaksi database, supaya tidak
    // pernah ada transaksi dengan header baru tapi item lama.
    const hasil = await db.$transaction(async (tx) => {
      await tx.transaksiItem.deleteMany({ where: { transaksiId: id } });
      return tx.transaksi.update({
        where: { id },
        data: {
          tanggal: row.tanggal,
          jenis: row.jenis,
          penjahitId: row.penjahitId,
          modelId: row.modelId,
          catatan: row.catatan,
          items: {
            create: row.items.map((it) => ({ warnaId: it.warnaId, ukuran: it.ukuran, jumlah: it.jumlah })),
          },
        },
        select: SELECT_TRANSAKSI,
      });
    });

    return jsonOk({ data: serialisasiTransaksi(hasil) });
  });
}

export async function DELETE(request: Request, { params }: Ctx) {
  return handle(async () => {
    await guardMutation(request);
    const id = await parseId(params);
    const db = getDb();
    const ada = await db.transaksi.findUnique({ where: { id }, select: { id: true } });
    if (!ada) throw notFound("Transaksi tidak ditemukan.");
    // Item terhapus otomatis lewat ON DELETE CASCADE di skema.
    await db.transaksi.delete({ where: { id } });
    return jsonOk({ ok: true, id });
  });
}
