// GET  /api/master/{entity}  -> daftar master
// POST /api/master/{entity}  -> buat master baru
//
// entity harus salah satu dari: boss, model, warna, penjahit. Selain itu 404.
// Tanpa DELETE: data dinonaktifkan lewat PATCH supaya riwayat transaksi utuh.

import { getDb } from "@/lib/db";
import { handle, jsonOk, conflict, notFound, badRequest, fromPrismaError } from "@/lib/api";
import { guardMutation, guardSession, readJson } from "@/lib/request";
import {
  buat,
  daftar,
  getNama,
  hasBossId,
  isMasterEntity,
  namaSudahDipakai,
  parseMasterCreate,
  pesanDuplikat,
  type MasterEntity,
} from "@/lib/master";

type Ctx = { params: Promise<{ entity: string }> };

export async function GET(request: Request, { params }: Ctx) {
  return handle(async () => {
    await guardSession();
    const { entity: raw } = await params;
    if (!isMasterEntity(raw)) throw notFound("Jenis data tidak dikenal.");
    const entity: MasterEntity = raw;

    const semua = new URL(request.url).searchParams.get("semua") === "1";
    return jsonOk({ data: await daftar(getDb(), entity, semua ? {} : { aktif: true }) });
  });
}

export async function POST(request: Request, { params }: Ctx) {
  return handle(async () => {
    await guardMutation(request);
    const { entity: raw } = await params;
    if (!isMasterEntity(raw)) throw notFound("Jenis data tidak dikenal.");
    const entity: MasterEntity = raw;

    const body = parseMasterCreate(entity, await readJson(request));
    const nama = getNama(body)!;
    const db = getDb();

    if (entity === "model" && hasBossId(body)) {
      const boss = await db.boss.findUnique({ where: { id: body.bossId } });
      if (!boss) throw badRequest("Boss tidak ditemukan.");
      if (!boss.aktif) throw badRequest("Boss yang dipilih sudah nonaktif.");
    }

    // Pengecekan duplikat insensitive huruf: pesan 409 yang jelas dan deterministik,
    // tidak bergantung pada pesan error database.
    if (await namaSudahDipakai(db, entity, nama, { bossId: hasBossId(body) ? body.bossId : undefined })) {
      throw conflict(pesanDuplikat(entity, nama));
    }

    try {
      return jsonOk({ data: await buat(db, entity, body) });
    } catch (err) {
      if ((err as { code?: string })?.code === "P2002") throw conflict(pesanDuplikat(entity, nama));
      return fromPrismaError(err);
    }
  });
}