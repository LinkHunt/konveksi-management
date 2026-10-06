/**
 * Snapshot semua tabel ke JSON, supaya migrasi schema bisa dibandingkan
 * sebelum dan sesudah. Dipakai sebelum migrasi warna ke item, karena di
 * situ angka sisa ikut berubah cara hitungnya.
 *
 *   npm run backup -- sebelum
 *   npm run backup -- sesudah
 *
 * Query sisa ditulis ulang di sini dengan SQL yang sama persis dengan
 * src/lib/sisa.ts, bukan mengimpornya. Alasannya: file src/lib/*.ts di repo
 * ini memakai import tanpa ekstensi (`./ukuran`), yang Next.js bisa resolve
 * tapi Node tidak. seed.ts dan ganti-password.ts hanya mengimpor file yang
 * sudah pakai ekstensi eksplisit, jadi tidak kena masalah yang sama.
 */

import { writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

function getDb(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum diisi.");
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });
}

/*
 * Salinan SELECT dari src/lib/sisa.ts tanpa bagian WHERE filter, supaya
 * snapshot sebelum vs sesudah dibandingkan apples-to-apples. Bentuk kolom
 * dan cara agregasi (FILTER, bukan CASE) sengaja disamakan.
 *
 * Warna diambil dari TransaksiItem, bukan dari header Transaksi, karena
 * warna sekarang ada di item (satu transaksi bisa punya beberapa warna).
 */
const SQL_SISA = `
  SELECT
    t."penjahitId"     AS "penjahitId",
    pj."nama"          AS "penjahitNama",
    m."pemilikId"      AS "pemilikId",
    b."nama"           AS "pemilikNama",
    t."modelId"        AS "modelId",
    m."nama"           AS "modelNama",
    ti."warnaId"       AS "warnaId",
    w."nama"           AS "warnaNama",
    ti."ukuran"::text  AS "ukuran",
    COALESCE(SUM(ti."jumlah") FILTER (WHERE t."jenis" = 'BAHAN_KELUAR'), 0) AS "bahanKeluar",
    COALESCE(SUM(ti."jumlah") FILTER (WHERE t."jenis" = 'SETORAN'), 0)      AS "setoran"
  FROM "Transaksi" t
  JOIN "TransaksiItem" ti ON ti."transaksiId" = t."id"
  JOIN "Penjahit" pj ON pj."id" = t."penjahitId"
  JOIN "ModelBaju" m ON m."id" = t."modelId"
  JOIN "Pemilik" b ON b."id" = m."pemilikId"
  JOIN "Warna" w ON w."id" = ti."warnaId"
  GROUP BY t."penjahitId", pj."nama", m."pemilikId", b."nama", t."modelId", m."nama",
           ti."warnaId", w."nama", ti."ukuran"
  ORDER BY pj."nama", m."nama", w."nama", ti."ukuran"
`;

const nama = process.argv[2] ?? "backup";

type BarisSisa = {
  penjahitId: number;
  penjahitNama: string;
  pemilikId: number;
  pemilikNama: string;
  modelId: number;
  modelNama: string;
  warnaId: number;
  warnaNama: string;
  ukuran: string;
  bahanKeluar: number | bigint;
  setoran: number | bigint;
};

async function main() {
  const db = getDb();

  const [pemilik, model, warna, penjahit, transaksi, sisaRaw] = await Promise.all([
    db.pemilik.findMany({ orderBy: { id: "asc" } }),
    db.modelBaju.findMany({ orderBy: { id: "asc" } }),
    db.warna.findMany({ orderBy: { id: "asc" } }),
    db.penjahit.findMany({ orderBy: { id: "asc" } }),
    db.transaksi.findMany({
      orderBy: { id: "asc" },
      include: { items: { orderBy: { id: "asc" } } },
    }),
    db.$queryRawUnsafe<BarisSisa[]>(SQL_SISA),
  ]);

  const sisa = sisaRaw.map((b) => {
    const keluar = Number(b.bahanKeluar);
    const setor = Number(b.setoran);
    const nilai = keluar - setor;
    return {
      penjahitId: b.penjahitId,
      penjahitNama: b.penjahitNama,
      pemilikId: b.pemilikId,
      pemilikNama: b.pemilikNama,
      modelId: b.modelId,
      modelNama: b.modelNama,
      warnaId: b.warnaId,
      warnaNama: b.warnaNama,
      ukuran: b.ukuran,
      bahanKeluar: keluar,
      setoran: setor,
      sisa: nilai,
      lebih: nilai < 0,
    };
  });

  const snapshot = {
    diambilPada: new Date().toISOString(),
    jumlah: {
      pemilik: pemilik.length,
      model: model.length,
      warna: warna.length,
      penjahit: penjahit.length,
      transaksi: transaksi.length,
      item: transaksi.reduce((s, t) => s + t.items.length, 0),
    },
    master: { pemilik, model, warna, penjahit },
    transaksi,
    // Sisa apa adanya: tanpa filter, tanpa membuang baris nol. Ini yang
    // dibandingkan sebelum vs sesudah migrasi.
    sisaMentah: sisa,
  };

  const file = `backup-${nama}.json`;
  await writeFile(file, JSON.stringify(snapshot, null, 2), "utf8");

  console.log(`Snapshot ditulis ke ${file}`);
  console.log("Jumlah:", JSON.stringify(snapshot.jumlah));
  console.log(
    `Baris sisa: ${sisa.length} | total sisa: ${sisa.reduce((s, b) => s + b.sisa, 0)} | lebih: ${sisa.filter((b) => b.lebih).length}`,
  );
  for (const b of sisa) {
    console.log(
      `  ${b.penjahitNama} | ${b.pemilikNama}/${b.modelNama}/${b.warnaNama} ${b.ukuran} ` +
        `=> keluar ${b.bahanKeluar}, setor ${b.setoran}, sisa ${b.sisa}${b.lebih ? " (LEBIH)" : ""}`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Backup gagal:", e);
    process.exit(1);
  });