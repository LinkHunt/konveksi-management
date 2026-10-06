// GET  /api/transaksi  -> daftar transaksi (filter + pagination)
// POST /api/transaksi  -> buat transaksi baru beserta itemnya
//
// Tanggal diperlakukan sebagai tanggal kalender Asia/Jakarta (WIB).

import type { Prisma } from "@prisma/client";
import { getDb } from "@/lib/db";
import { handle, jsonOk, badRequest } from "@/lib/api";
import { guardMutation, guardSession, readJson, intParam } from "@/lib/request";
import { transaksiSchema } from "@/lib/validators";
import {
  SELECT_TRANSAKSI,
  parseTanggalWIB,
  pastikanMaster,
  serialisasiTransaksi,
  siapSimpan,
} from "@/lib/transaksi";

const LIMIT_DEFAULT = 20;
const LIMIT_MAX = 100;

export async function GET(request: Request) {
  return handle(async () => {
    await guardSession();
    const url = new URL(request.url);

    const page = intParam(url, "page", { min: 1 }) ?? 1;
    const limit = intParam(url, "limit", { min: 1, max: LIMIT_MAX }) ?? LIMIT_DEFAULT;

    const jenis = url.searchParams.get("jenis");
    if (jenis !== null && jenis !== "SETORAN" && jenis !== "BAHAN_KELUAR") {
      throw badRequest("jenis harus SETORAN atau BAHAN_KELUAR.");
    }

    const where: Prisma.TransaksiWhereInput = {};
    if (jenis) where.jenis = jenis;

    const penjahitId = intParam(url, "penjahitId", { min: 1 });
    if (penjahitId !== undefined) where.penjahitId = penjahitId;

    const modelId = intParam(url, "modelId", { min: 1 });
    if (modelId !== undefined) where.modelId = modelId;

    const pemilikId = intParam(url, "pemilikId", { min: 1 });
    if (pemilikId !== undefined) where.model = { pemilikId };

    // Rentang tanggal. Kolomnya DATE, jadi batas bawah inklusif dan batas atas
    // juga inklusif (tanggal yang sama masih dihitung).
    const dari = url.searchParams.get("tanggalDari");
    const sampai = url.searchParams.get("tanggalSampai");
    if (dari !== null || sampai !== null) {
      where.tanggal = {};
      if (dari !== null) {
        const d = parseTanggalWIB(dari);
        if (!d) throw badRequest("tanggalDari tidak valid. Gunakan format YYYY-MM-DD.");
        where.tanggal.gte = d;
      }
      if (sampai !== null) {
        const d = parseTanggalWIB(sampai);
        if (!d) throw badRequest("tanggalSampai tidak valid. Gunakan format YYYY-MM-DD.");
        where.tanggal.lte = d;
      }
    }

    const db = getDb();
    const [total, rows] = await Promise.all([
      db.transaksi.count({ where }),
      db.transaksi.findMany({
        where,
        select: SELECT_TRANSAKSI,
        orderBy: [{ tanggal: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return jsonOk({
      data: rows.map(serialisasiTransaksi),
      paging: { page, limit, total, totalHalaman: Math.ceil(total / limit) || 1 },
    });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    await guardMutation(request);
    const body = transaksiSchema.parse(await readJson(request));
    const row = await siapSimpan(body);

    await pastikanMaster(
      {
        penjahitId: row.penjahitId,
        modelId: row.modelId,
        warnaId: [...new Set(row.items.map((i) => i.warnaId))],
      },
      { toleransiNonaktif: false },
    );

    const db = getDb();
    // Nested create = satu operasi atomik; item ikut tersimpan atau tidak sama sekali.
    const dibuat = await db.transaksi.create({
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

    return jsonOk({ data: serialisasiTransaksi(dibuat) });
  });
}
