/**
 * Bandingkan dua snapshot backup secara otomatis, jangan pakai mata.
 *
 *   npm run bandingkan -- sebelum sesudah
 *
 * Yang dibandingkan, dari yang paling penting:
 *   1. Baris sisa per kunci penjahit|model|warna|ukuran. Ini yang paling
 *      vulnerable: migrasi warna ke item mengubah cara sisa dihitung, jadi
 *      kalau di sini meleset, angka yang tampil di halaman Sisa ikut bohong.
 *   2. Isi master (id + nama + aktif). Kalau berubah, berarti migrasi damaging
 *      data acuan.
 *   3. Header transaksi dan itemnya, per ukuran.
 *
 * Keluar dengan kode selain 0 kalau ada beda, supaya tidak bisa lolos tanpa
 * sengaja.
 */

import { readFile } from "node:fs/promises";

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
  bahanKeluar: number;
  setoran: number;
  sisa: number;
  lebih: boolean;
};

type Item = { ukuran: string; jumlah: number };
type Transaksi = {
  id: number;
  tanggal: string;
  jenis: string;
  penjahitId: number;
  modelId: number;
  catatan: string | null;
  items: Item[];
};

type Snapshot = {
  diambilPada: string;
  jumlah: Record<string, number>;
  master: Record<string, { id: number; nama: string; aktif: boolean }[]>;
  transaksi: Transaksi[];
  sisaMentah: BarisSisa[];
};

type Beda = { bagian: string; pesan: string };

async function muat(nama: string): Promise<Snapshot> {
  return JSON.parse(await readFile(`backup-${nama}.json`, "utf8")) as Snapshot;
}

const beda: Beda[] = [];
function catat(bagian: string, pesan: string) {
  beda.push({ bagian, pesan });
}

/** Kunci baris sisa. Nama ikut dibawa supaya beda nama langsung ketahuan. */
function kunciSisa(b: BarisSisa): string {
  return `${b.penjahitId}|${b.modelId}|${b.warnaId}|${b.ukuran}`;
}

function bandingkanSisa(a: Snapshot, b: Snapshot) {
  const ka = new Map(a.sisaMentah.map((x) => [kunciSisa(x), x]));
  const kb = new Map(b.sisaMentah.map((x) => [kunciSisa(x), x]));

  for (const [k, x] of ka) {
    const y = kb.get(k);
    if (!y) {
      catat("sisa", `hilang di sesudah: ${x.penjahitNama} | ${x.modelNama}/${x.warnaNama} ${x.ukuran}`);
      continue;
    }
    for (const f of ["bahanKeluar", "setoran", "sisa"] as const) {
      if (x[f] !== y[f]) {
        catat("sisa", `${x.penjahitNama} | ${x.modelNama}/${x.warnaNama} ${x.ukuran} — ${f}: ${x[f]} -> ${y[f]}`);
      }
    }
    if (x.lebih !== y.lebih) {
      catat("sisa", `${x.penjahitNama} | ${x.modelNama}/${x.warnaNama} ${x.ukuran} — flag lebih berubah`);
    }
  }
  for (const [k, y] of kb) {
    if (!ka.has(k)) {
      catat("sisa", `muncul di sesudah: ${y.penjahitNama} | ${y.modelNama}/${y.warnaNama} ${y.ukuran} = ${y.sisa}`);
    }
  }

  const totalA = a.sisaMentah.reduce((s, x) => s + x.sisa, 0);
  const totalB = b.sisaMentah.reduce((s, x) => s + x.sisa, 0);
  if (totalA !== totalB) catat("sisa", `total sisa: ${totalA} -> ${totalB}`);
}

function bandingkanMaster(a: Snapshot, b: Snapshot) {
  for (const ent of Object.keys(a.master)) {
    const da = a.master[ent];
    const db = b.master[ent];
    if (da.length !== db.length) {
      catat("master", `${ent}: jumlah baris ${da.length} -> ${db.length}`);
      continue;
    }
    const mb = new Map(db.map((x) => [x.id, x]));
    for (const x of da) {
      const y = mb.get(x.id);
      if (!y) {
        catat("master", `${ent} #${x.id} (${x.nama}) hilang`);
        continue;
      }
      if (x.nama !== y.nama) catat("master", `${ent} #${x.id} nama: "${x.nama}" -> "${y.nama}"`);
      if (x.aktif !== y.aktif) catat("master", `${ent} #${x.id} (${x.nama}) aktif: ${x.aktif} -> ${y.aktif}`);
    }
  }
}

function bandingkanTransaksi(a: Snapshot, b: Snapshot) {
  if (a.transaksi.length !== b.transaksi.length) {
    catat("transaksi", `jumlah transaksi: ${a.transaksi.length} -> ${b.transaksi.length}`);
  }
  const mb = new Map(b.transaksi.map((t) => [t.id, t]));
  for (const x of a.transaksi) {
    const y = mb.get(x.id);
    if (!y) {
      catat("transaksi", `#${x.id} hilang`);
      continue;
    }
    for (const f of ["tanggal", "jenis", "penjahitId", "modelId"] as const) {
      const va = String(x[f]);
      const vb = String(y[f]);
      if (va !== vb) catat("transaksi", `#${x.id} ${f}: ${va} -> ${vb}`);
    }
    // Item dibandingkan per warna+ukuran. Warna tidak ikut karena memang
    // baru pindah ke item di migrasi ini, tapi ukurannya harus sama.
    const jmlA = x.items.reduce((s, i) => s + i.jumlah, 0);
    const jmlB = y.items.reduce((s, i) => s + i.jumlah, 0);
    if (jmlA !== jmlB) catat("transaksi", `#${x.id} total item: ${jmlA} -> ${jmlB}`);
    for (const i of x.items) {
      const cocok = y.items.find((j) => j.ukuran === i.ukuran && j.jumlah === i.jumlah);
      if (!cocok) catat("transaksi", `#${x.id} item ${i.ukuran}=${i.jumlah} tidak ada di sesudah`);
    }
  }
}

async function main() {
  const namaA = process.argv[2];
  const namaB = process.argv[3];
  if (!namaA || !namaB) {
    console.error("Pakai: npm run bandingkan -- <sebelum> <sesudah>");
    process.exit(2);
  }

  const [a, b] = await Promise.all([muat(namaA), muat(namaB)]);
  console.log(`Membandingkan backup-${namaA} (${a.diambilPada})`);
  console.log(`dengan          backup-${namaB} (${b.diambilPada})`);
  console.log("");

  bandingkanSisa(a, b);
  bandingkanMaster(a, b);
  bandingkanTransaksi(a, b);

  // Ringkasan jumlah baris, biar kelihatan walau tidak ada beda.
  for (const tabel of Object.keys(a.master)) {
    const n = `${tabel}=${a.master[tabel].length}`;
    process.stdout.write(`${n} `);
  }
  console.log(
    `transaksi=${a.transaksi.length} barisSisa=${a.sisaMentah.length} -> ` +
      `barisSisa=${b.sisaMentah.length}`,
  );
  console.log("");

  if (beda.length === 0) {
    console.log(`IDENTIK: tidak ada beda antara "${namaA}" dan "${namaB}".`);
    return;
  }

  console.log(`ADA ${beda.length} BEDA:`);
  const perBagian = new Map<string, string[]>();
  for (const d of beda) {
    const arr = perBagian.get(d.bagian) ?? [];
    arr.push(d.pesan);
    perBagian.set(d.bagian, arr);
  }
  for (const [bagian, pesan] of perBagian) {
    console.log(`\n[${bagian}]`);
    for (const p of pesan) console.log(`  - ${p}`);
  }
  console.log("\nJangan deploy sebelum diperiksa.");
  process.exitCode = 1;
}

main().catch((e) => {
  console.error("Bandingkan gagal:", e);
  process.exit(1);
});
