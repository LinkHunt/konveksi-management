// Bersihkan data uji smoke test.
//
// Hanya menghapus data yang namanya berawalan "TES-". Data lain tidak pernah
// disentuh. Dipakai oleh scripts/smoke-test.sh karena API master sengaja tidak
// menyediakan DELETE (master dinonaktifkan, bukan dihapus, supaya riwayat
// transaksi lama tetap utuh).
//
//   node --env-file=.env scripts/smoke-cleanup.ts
//
// Urutan penghapusan penting: model dihapus sebelum pemilik, karena kolom
// pemilikId punya foreign key dengan aturan RESTRICT. Kalau dihapus paralel,
// pemilik bisa lebih dulu hilang dan database menolak.
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

    // Transaksi ikut terhapus kalau salah satu master yang dipakainya berawalan
    // TES-. Item terhapus otomatis lewat ON DELETE CASCADE di skema.
    // Warna tidak lagi ada di header transaksi, jadi dicari lewat item.
    const or: Prisma.TransaksiWhereInput[] = [];
    if (penjahit.length) or.push({ penjahitId: { in: ids(penjahit) } });
    if (model.length) or.push({ modelId: { in: ids(model) } });
    if (warna.length) or.push({ items: { some: { warnaId: { in: ids(warna) } } } });
    if (pemilik.length) or.push({ model: { pemilikId: { in: ids(pemilik) } } });

    let hapusTransaksi = 0;
    if (or.length) {
      const trans = await db.transaksi.findMany({ where: { OR: or }, select: { id: true } });
      if (trans.length) {
        hapusTransaksi = (await db.transaksi.deleteMany({ where: { id: { in: ids(trans) } } })).count;
      }
    }

    // Urutan WAJIB berurutan, bukan paralel: model memakai pemilik sebagai FK
    // dengan ON DELETE RESTRICT.
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
      `  cleanup: transaksi=${hapusTransaksi} model=${hModel} ` +
        `warna=${hWarna?.count ?? 0} penjahit=${hPenjahit?.count ?? 0} pemilik=${hPemilik}`,
    );
  } finally {
    await db.$disconnect();
  }
}

await main();