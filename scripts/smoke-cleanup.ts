// Bersihkan data uji smoke test.
//
// Hanya menghapus data yang model/pemilik/warnanya berawalan "TES-". Data lain
// tidak pernah disentuh. Dipakai oleh scripts/smoke-test.sh karena API master
// sengaja tidak menyediakan DELETE (master dinonaktifkan, bukan dihapus,
// supaya riwayat lama tetap utuh).
//
//   node --env-file=.env scripts/smoke-cleanup.ts
//
// Urutan penghapusan penting:
//   1. HasilPotong & HasilPotongRiwayat dari model / warna TES-.
//   2. Setoran & SetoranItem dari model / warna TES-.
//   3. Model dihapus sebelum pemilik (FK pemilikId RESTRICT, dan hasil potong
//      juga memakai modelId dengan FK RESTRICT).
//   4. Warna, penjahit, pemilik terakhir.
//
// Tidak mencetak kredensial apa pun, hanya jumlah baris yang terpengaruh.

import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const PREFIX = "TES-";

function ids<T extends { id: number }>(rows: T[]): number[] {
  return rows.map((r) => r.id);
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum diisi.");
  const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });

  try {
    const awal = { nama: { startsWith: PREFIX } } as const;
    const [pemilik, model, warna, penjahit] = await Promise.all([
      db.pemilik.findMany({ where: awal, select: { id: true } }),
      db.modelBaju.findMany({ where: awal, select: { id: true } }),
      db.warna.findMany({ where: awal, select: { id: true } }),
      db.penjahit.findMany({ where: awal, select: { id: true } }),
    ]);

    // Hasil potong milik model / warna TES-. Riwayat dihapus manual karena
    // tidak punya FK ke baris induk (sengaja, supaya riwayat tetap ada setelah
    // baris dihapus) — jadi versi smoke harus ikut dihapus. Riwayat JUGA punya
    // FK RESTRICT ke ModelBaju, jadi wajib dibersihkan sebelum model dihapus.
    const hpWhere: Prisma.HasilPotongWhereInput[] = [];
    if (model.length) hpWhere.push({ modelId: { in: ids(model) } });
    if (warna.length) hpWhere.push({ warnaId: { in: ids(warna) } });
    let hpHapus = 0;
    let hpRiwayatHapus = 0;
    if (hpWhere.length) {
      const hp = await db.hasilPotong.findMany({
        where: { OR: hpWhere },
        select: { id: true },
      });
      if (hp.length) {
        hpRiwayatHapus = (
          await db.hasilPotongRiwayat.deleteMany({
            where: { hasilPotongId: { in: ids(hp) } },
          })
        ).count;
        hpHapus = (await db.hasilPotong.deleteMany({ where: { id: { in: ids(hp) } } })).count;
      }
      // Riwayat milik model TES- yang menunjuk baris hasil potong model lain
      // (tidak ketangkap dari hp) tetap harus digugurkan sebelum hapus model.
      if (model.length) {
        hpRiwayatHapus += (
          await db.hasilPotongRiwayat.deleteMany({ where: { modelId: { in: ids(model) } } })
        ).count;
      }
    }

    // Setoran dari model / warna TES-. Item ikut terhapus ON DELETE CASCADE.
    const setoranWhere: Prisma.SetoranWhereInput[] = [];
    const setoranItemWhere = (m?: number[], w?: number[]): Prisma.SetoranWhereInput[] => {
      const or: Prisma.SetoranWhereInput[] = [];
      if (m?.length) or.push({ items: { some: { modelId: { in: m } } } });
      if (w?.length) or.push({ items: { some: { warnaId: { in: w } } } });
      return or;
    };
    const orS = setoranItemWhere(ids(model), ids(warna));
    if (orS.length) setoranWhere.push(...orS);
    let setoranHapus = 0;
    if (setoranWhere.length) {
      const s = await db.setoran.findMany({
        where: { OR: setoranWhere },
        select: { id: true },
      });
      if (s.length) {
        setoranHapus = (await db.setoran.deleteMany({ where: { id: { in: ids(s) } } })).count;
      }
    }

    // Urutan WAJIB berurutan: model memakai pemilik sebagai FK RESTRICT.
    const hModel = model.length
      ? (await db.modelBaju.deleteMany({ where: { id: { in: ids(model) } } })).count
      : 0;

    const [hWarna, hPenjahit] = await Promise.all([
      warna.length ? db.warna.deleteMany({ where: { id: { in: ids(warna) } } }) : null,
      penjahit.length ? db.penjahit.deleteMany({ where: { id: { in: ids(penjahit) } } }) : null,
    ]);

    const hPemilik = pemilik.length
      ? (await db.pemilik.deleteMany({ where: { id: { in: ids(pemilik) } } })).count
      : 0;

    console.log(
      `  cleanup: hasilPotong=${hpHapus} hasilPotongRiwayat=${hpRiwayatHapus} setoran=${setoranHapus} ` +
        `model=${hModel} warna=${hWarna?.count ?? 0} penjahit=${hPenjahit?.count ?? 0} pemilik=${hPemilik}`,
    );
  } finally {
    await db.$disconnect();
  }
}

await main();