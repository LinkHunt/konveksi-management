// GET   /api/master/{entity}/{id}  -> detail
// PATCH /api/master/{entity}/{id}  -> ubah nama / status aktif
//
// Tidak ada DELETE. Menonaktifkan (aktif:false) dipakai supaya riwayat
// transaksi lama tetap utuh.

import { getDb } from "@/lib/db";
import { handle, jsonOk, notFound, badRequest, conflict, fromPrismaError } from "@/lib/api";
import { guardMutation, guardSession, readJson } from "@/lib/request";
import {
  LABEL_ENTITY,
  ambil,
  getNama,
  hasBossId,
  isMasterEntity,
  jumlahTransaksiMemakai,
  masterSedangDipakai,
  namaSudahDipakai,
  parseMasterPatch,
  pesanDuplikat,
  ubah,
  type MasterEntity,
} from "@/lib/master";

type Ctx = { params: Promise<{ entity: string; id: string }> };

async function parseCtx(params: Promise<{ entity: string; id: string }>) {
  const { entity: raw, id: rawId } = await params;
  if (!isMasterEntity(raw)) throw notFound("Jenis data tidak dikenal.");
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Id tidak valid.");
  return { entity: raw as MasterEntity, id };
}

export async function GET(_request: Request, { params }: Ctx) {
  return handle(async () => {
    await guardSession();
    const { entity, id } = await parseCtx(params);
    const row = await ambil(getDb(), entity, id);
    if (!row) throw notFound(`${LABEL_ENTITY[entity]} tidak ditemukan.`);
    return jsonOk({ data: row });
  });
}

export async function PATCH(request: Request, { params }: Ctx) {
  return handle(async () => {
    await guardMutation(request);
    const { entity, id } = await parseCtx(params);
    const body = parseMasterPatch(entity, await readJson(request));
    const db = getDb();

    if (entity === "model" && hasBossId(body) && body.bossId !== undefined) {
      const boss = await db.boss.findUnique({ where: { id: body.bossId } });
      if (!boss) throw badRequest("Boss tidak ditemukan.");
      if (!boss.aktif) throw badRequest("Boss yang dipilih sudah nonaktif.");
    }

    const sekarang = await ambil(db, entity, id);
    if (!sekarang) throw notFound(`${LABEL_ENTITY[entity]} tidak ditemukan.`);

    // Menonaktifkan master yang sudah dipakai transaksi akan mengubah laporan
    // sisa tanpa jejak, jadi ditolak.
    if (body.aktif === false && sekarang.aktif) {
      const dipakai = await jumlahTransaksiMemakai(db, entity, id);
      if (dipakai > 0) {
        throw conflict(masterSedangDipakai(entity), { jumlahTransaksi: dipakai });
      }
    }

    const namaBaru = getNama(body);
    if (namaBaru !== undefined && namaBaru !== sekarang.nama) {
      // Untuk entity model, duplikat dilihat dari kombinasi bossId + nama.
      const bossIdSekarang = "bossId" in sekarang ? sekarang.bossId : undefined;
      const bossIdBaru = hasBossId(body) ? body.bossId : bossIdSekarang;
      if (await namaSudahDipakai(db, entity, namaBaru, { bossId: bossIdBaru, excludeId: id })) {
        throw conflict(pesanDuplikat(entity, namaBaru));
      }
    }

    const data: { nama?: string; aktif?: boolean; bossId?: number } = {};
    if (namaBaru !== undefined) data.nama = namaBaru;
    if (body.aktif !== undefined) data.aktif = body.aktif;
    if (entity === "model" && hasBossId(body) && body.bossId !== undefined) {
      data.bossId = body.bossId;
    }

    try {
      return jsonOk({ data: await ubah(db, entity, id, data) });
    } catch (err) {
      if ((err as { code?: string })?.code === "P2002") {
        throw conflict(pesanDuplikat(entity, namaBaru ?? ""));
      }
      return fromPrismaError(err);
    }
  });
}