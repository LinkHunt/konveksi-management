// Logika hasil potongan untuk aplikasi offline (sql.js).
//
// Hasil potongan adalah sumber data yang benar. Setoran tidak boleh melebihi
// potongan, karena potongan datang dari buku hasil potongan milik bibi dan
// setoran cuma menyalin angka itu menjadi riwayat.
//
// Seluruh query memakai helper di ./db (semua/satu/jalankan). ID integer.
// Ukuran disimpan sebagai TEXT label ('XS'..'8L').

import { semua, satu, jalankan, getDb, simpanDb } from "./db";
import { toLabelUkuran, isUkuranLabel, type UkuranLabel } from "./ukuran";
import { badRequest, notFound } from "./api";

export type BarisHasilPotong = {
  id: number;
  warnaId: number;
  warnaNama: string;
  ukuran: UkuranLabel;
  jumlah: number;
};

export type HasilPotongPerModel = {
  modelId: number;
  modelNama: string;
  pemilikId: number;
  pemilikNama: string;
  total: number;
  warna: { warnaId: number; warnaNama: string; baris: BarisHasilPotong[]; subtotal: number }[];
};

type RowPotong = {
  id: number;
  modelId: number;
  modelNama: string;
  pemilikId: number;
  pemilikNama: string;
  warnaId: number;
  warnaNama: string;
  ukuran: string;
  jumlah: number;
};

/**
 * Rincian hasil potong per model, dikelompokkan per warna lalu per ukuran.
 * Hanya model yang punya catatan yang muncul. Total dihitung saat tampil.
 */
export function daftarHasilPotong(
  filter: { pemilikId?: number; modelId?: number } = {},
): HasilPotongPerModel[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.modelId !== undefined) {
    where.push("hp.modelId = ?");
    params.push(filter.modelId);
  }
  if (filter.pemilikId !== undefined) {
    where.push("m.pemilikId = ?");
    params.push(filter.pemilikId);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const rows = semua<RowPotong>(
    `
    SELECT
      m.id            AS modelId,
      m.nama          AS modelNama,
      p.id            AS pemilikId,
      p.nama          AS pemilikNama,
      hp.id           AS id,
      hp.warnaId      AS warnaId,
      w.nama          AS warnaNama,
      hp.ukuran       AS ukuran,
      hp.jumlah       AS jumlah
    FROM HasilPotong hp
    JOIN ModelBaju m ON m.id = hp.modelId
    JOIN Pemilik p  ON p.id = m.pemilikId
    JOIN Warna w    ON w.id = hp.warnaId
    ${whereSql}
    ORDER BY m.id, hp.warnaId
    `,
    params,
  );

  const perModel = new Map<number, HasilPotongPerModel>();
  for (const r of rows) {
    let m = perModel.get(r.modelId);
    if (!m) {
      m = {
        modelId: r.modelId,
        modelNama: r.modelNama,
        pemilikId: r.pemilikId,
        pemilikNama: r.pemilikNama,
        total: 0,
        warna: [],
      };
      perModel.set(r.modelId, m);
    }
    let w = m.warna.find((x) => x.warnaId === r.warnaId);
    if (!w) {
      w = { warnaId: r.warnaId, warnaNama: r.warnaNama, baris: [], subtotal: 0 };
      m.warna.push(w);
    }
    const baris: BarisHasilPotong = {
      id: r.id,
      warnaId: r.warnaId,
      warnaNama: r.warnaNama,
      ukuran: (toLabelUkuran(r.ukuran) ?? r.ukuran) as UkuranLabel,
      jumlah: r.jumlah,
    };
    w.baris.push(baris);
    w.subtotal += baris.jumlah;
    m.total += baris.jumlah;
  }

  return [...perModel.values()].sort((a, b) => a.modelNama.localeCompare(b.modelNama, "id"));
}

/** Semua riwayat untuk satu hasil potong, terbaru dulu. */
export function riwayatHasilPotong(hasilPotongId: number): BarisRiwayat[] {
  const rows = semua<{
    id: number;
    aksi: string;
    modelNama: string;
    pemilikNama: string;
    warnaNama: string;
    ukuran: string;
    jumlahLama: number | null;
    jumlahBaru: number | null;
    createdAt: string;
  }>(
    `
    SELECT
      hr.id,
      hr.aksi,
      m.nama AS modelNama,
      p.nama AS pemilikNama,
      w.nama AS warnaNama,
      hr.ukuran,
      hr.jumlahLama,
      hr.jumlahBaru,
      hr.createdAt
    FROM HasilPotongRiwayat hr
    JOIN ModelBaju m ON m.id = hr.modelId
    JOIN Pemilik p ON p.id = m.pemilikId
    JOIN Warna w   ON w.id = hr.warnaId
    WHERE hr.hasilPotongId = ?
    ORDER BY hr.id DESC
    `,
    [hasilPotongId],
  );
  return rows.map((r) => ({
    id: r.id,
    aksi: r.aksi as "BUAT" | "UBAH" | "HAPUS",
    modelNama: r.modelNama,
    pemilikNama: r.pemilikNama,
    warnaNama: r.warnaNama,
    ukuran: (toLabelUkuran(r.ukuran) ?? r.ukuran) as UkuranLabel,
    jumlahLama: r.jumlahLama,
    jumlahBaru: r.jumlahBaru,
    waktu: new Date(r.createdAt ?? Date.now()),
  }));
}

/** Total setoran per kombinasi model + warna + ukuran, dipakai validasi. */
export function totalSetoranPerKombinasi(): Map<string, number> {
  const rows = semua<{ modelId: number; warnaId: number; ukuran: string; total: number }>(
    `
    SELECT modelId, warnaId, ukuran, SUM(jumlah) AS total
    FROM SetoranItem
    GROUP BY modelId, warnaId, ukuran
    `,
  );
  const peta = new Map<string, number>();
  for (const r of rows) {
    peta.set(`${r.modelId}|${r.warnaId}|${r.ukuran}`, r.total ?? 0);
  }
  return peta;
}

/** Catat aksi ke riwayat (dalam transaksi yang sama dengan mutasi utama). */
function tulisRiwayat(
  data: {
    hasilPotongId: number;
    aksi: "BUAT" | "UBAH" | "HAPUS";
    modelId: number;
    warnaId: number;
    ukuran: UkuranLabel;
    jumlahLama?: number | null;
    jumlahBaru?: number | null;
  },
): void {
  jalankan(
    `INSERT INTO HasilPotongRiwayat
      (hasilPotongId, aksi, modelId, warnaId, ukuran, jumlahLama, jumlahBaru)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.hasilPotongId,
      data.aksi,
      data.modelId,
      data.warnaId,
      data.ukuran,
      data.jumlahLama ?? null,
      data.jumlahBaru ?? null,
    ],
  );
}

/**
 * Simpan hasil potong untuk satu model: baris-baris warna sekaligus.
 * Kombinasi model + warna + ukuran SAMA ditimpa (koreksi, bukan baris dua).
 * Model & warna harus ada + aktif. Seluruh proses + riwayat dalam 1 transaksi
 * (sql.js `db.run` + export manual — pakai transaksi eksplisit via run).
 */
export async function simpanHasilPotong(input: {
  modelId: number;
  baris: { warnaId: number; ukuran: string; jumlah: unknown }[];
}): Promise<void> {
  const db = getDb();

  const model = satu<{ id: number; aktif: number }>(
    `SELECT id, aktif FROM ModelBaju WHERE id = ?`,
    [input.modelId],
  );
  if (!model) throw badRequest("Model baju tidak ditemukan.");
  if (!model.aktif) throw badRequest("Model baju yang dipilih sudah nonaktif.");

  const warnaIds = [...new Set(input.baris.map((b) => b.warnaId))];
  const warnaRows = semua<{ id: number; nama: string; aktif: number }>(
    `SELECT id, nama, aktif FROM Warna WHERE id IN (${warnaIds.map(() => "?").join(",")})`,
    warnaIds,
  );
  const byId = new Map(warnaRows.map((w) => [w.id, w]));
  const hilang = warnaIds.filter((id) => !byId.has(id));
  if (hilang.length > 0) {
    throw badRequest(`Warna tidak ditemukan: ${hilang.map((id) => `#${id}`).join(", ")}.`);
  }
  for (const id of warnaIds) {
    const w = byId.get(id)!;
    if (!w.aktif) throw badRequest(`Warna ${w.nama} sudah nonaktif.`);
  }

  // Normalisasi: buang jumlah <= 0, deteksi duplikat warna+ukuran.
  const items: { warnaId: number; ukuran: UkuranLabel; jumlah: number }[] = [];
  const seen = new Set<string>();
  for (const b of input.baris) {
    const jumlah = typeof b.jumlah === "number" ? b.jumlah : Number(b.jumlah);
    if (!Number.isFinite(jumlah) || !Number.isInteger(jumlah) || jumlah < 0) continue;
    if (jumlah <= 0) continue;
    if (!isUkuranLabel(b.ukuran)) {
      throw badRequest(`Ukuran tidak dikenal: ${String(b.ukuran)}.`);
    }
    const ukuran = b.ukuran;
    const key = `${b.warnaId}|${ukuran}`;
    if (seen.has(key)) {
      const nama = byId.get(b.warnaId)?.nama ?? `warna #${b.warnaId}`;
      throw badRequest(
        `${nama} ukuran ${ukuran} muncul lebih dari sekali. Gabungkan jumlahnya jadi satu baris.`,
      );
    }
    seen.add(key);
    items.push({ warnaId: b.warnaId, ukuran, jumlah });
  }
  if (items.length === 0) {
    throw badRequest("Minimal satu baris warna dan ukuran dengan jumlah lebih dari 0.");
  }

  // Transaksi: sql.js `BEGIN`/`COMMIT` manual; simpan file setelah selesai.
  db.exec("BEGIN");
  try {
    for (const it of items) {
      const lama = satu<{ id: number; jumlah: number }>(
        `SELECT id, jumlah FROM HasilPotong
         WHERE modelId = ? AND warnaId = ? AND ukuran = ?`,
        [input.modelId, it.warnaId, it.ukuran],
      );
      if (!lama) {
        jalankan(
          `INSERT INTO HasilPotong (modelId, warnaId, ukuran, jumlah, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [input.modelId, it.warnaId, it.ukuran, it.jumlah],
        );
        const baru = satu<{ id: number }>(
          `SELECT id FROM HasilPotong WHERE modelId = ? AND warnaId = ? AND ukuran = ?`,
          [input.modelId, it.warnaId, it.ukuran],
        )!;
        tulisRiwayat({
          hasilPotongId: baru.id,
          aksi: "BUAT",
          modelId: input.modelId,
          warnaId: it.warnaId,
          ukuran: it.ukuran,
          jumlahBaru: it.jumlah,
        });
      } else {
        jalankan(
          `UPDATE HasilPotong SET jumlah = ?, updatedAt = datetime('now') WHERE id = ?`,
          [it.jumlah, lama.id],
        );
        tulisRiwayat({
          hasilPotongId: lama.id,
          aksi: "UBAH",
          modelId: input.modelId,
          warnaId: it.warnaId,
          ukuran: it.ukuran,
          jumlahLama: lama.jumlah,
          jumlahBaru: it.jumlah,
        });
      }
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  await simpanDb();
}

/** Koreksi jumlah satu baris hasil potong (dibatasi total setoran). */
export async function koreksiHasilPotong(id: number, jumlahBaru: number): Promise<void> {
  if (!Number.isInteger(jumlahBaru) || jumlahBaru < 0) {
    throw badRequest("Jumlah harus angka bulat 0 atau lebih.");
  }
  const db = getDb();
  const lama = satu<{ jumlah: number; modelId: number; warnaId: number; ukuran: string }>(
    `SELECT jumlah, modelId, warnaId, ukuran FROM HasilPotong WHERE id = ?`,
    [id],
  );
  if (!lama) throw notFound("Hasil potong tidak ditemukan.");

  const sudahSetor =
    satu<{ total: number | null }>(
      `SELECT SUM(jumlah) AS total FROM SetoranItem
       WHERE modelId = ? AND warnaId = ? AND ukuran = ?`,
      [lama.modelId, lama.warnaId, lama.ukuran],
    )?.total ?? 0;
  const totalSetor = sudahSetor ?? 0;
  if (jumlahBaru < totalSetor) {
    throw badRequest(
      `Jumlah tidak bisa diturunkan ke ${jumlahBaru}. Kombinasi ini sudah disetor ${totalSetor} pcs.`,
      { totalSetor, jumlahBaru },
    );
  }

  db.exec("BEGIN");
  try {
    jalankan(`UPDATE HasilPotong SET jumlah = ?, updatedAt = datetime('now') WHERE id = ?`, [
      jumlahBaru,
      id,
    ]);
    tulisRiwayat({
      hasilPotongId: id,
      aksi: "UBAH",
      modelId: lama.modelId,
      warnaId: lama.warnaId,
      ukuran: (toLabelUkuran(lama.ukuran) ?? lama.ukuran) as UkuranLabel,
      jumlahLama: lama.jumlah,
      jumlahBaru,
    });
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  await simpanDb();
}

/** Hapus satu baris hasil potong (diblokir kalau sudah ada setoran). */
export async function hapusHasilPotong(id: number): Promise<void> {
  const db = getDb();
  const lama = satu<{ jumlah: number; modelId: number; warnaId: number; ukuran: string }>(
    `SELECT jumlah, modelId, warnaId, ukuran FROM HasilPotong WHERE id = ?`,
    [id],
  );
  if (!lama) throw notFound("Hasil potong tidak ditemukan.");

  const totalSetor =
    satu<{ total: number | null }>(
      `SELECT SUM(jumlah) AS total FROM SetoranItem
       WHERE modelId = ? AND warnaId = ? AND ukuran = ?`,
      [lama.modelId, lama.warnaId, lama.ukuran],
    )?.total ?? 0;

  if (totalSetor > 0) {
    throw badRequest(
      `Hasil potong ini sudah disetor ${totalSetor} pcs, tidak bisa dihapus.`,
      { totalSetor },
    );
  }

  db.exec("BEGIN");
  try {
    jalankan(`DELETE FROM HasilPotong WHERE id = ?`, [id]);
    tulisRiwayat({
      hasilPotongId: id,
      aksi: "HAPUS",
      modelId: lama.modelId,
      warnaId: lama.warnaId,
      ukuran: (toLabelUkuran(lama.ukuran) ?? lama.ukuran) as UkuranLabel,
      jumlahLama: lama.jumlah,
    });
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  await simpanDb();
}

/**
 * Hapus seluruh hasil potong untuk satu model (semua warna + ukuran).
 * Menolak kalau salah satu kombinasi sudah disetor.
 */
export async function hapusHasilPotongModel(modelId: number): Promise<number> {
  const db = getDb();
  const baris = semua<{ id: number; modelId: number; warnaId: number; ukuran: string; jumlah: number }>(
    `SELECT id, modelId, warnaId, ukuran, jumlah FROM HasilPotong WHERE modelId = ?`,
    [modelId],
  );

  // Cek dulu kombinasi yang sudah disetor — tolak satu pun.
  for (const b of baris) {
    const total =
      satu<{ total: number | null }>(
        `SELECT SUM(jumlah) AS total FROM SetoranItem
         WHERE modelId = ? AND warnaId = ? AND ukuran = ?`,
        [b.modelId, b.warnaId, b.ukuran],
      )?.total ?? 0;
    if (total > 0) {
      throw badRequest(
        `Salah satu hasil potong sudah disetor ${total} pcs, tidak bisa dihapus sekaligus.`,
      );
    }
  }

  if (baris.length === 0) return 0;

  db.exec("BEGIN");
  try {
    for (const b of baris) {
      jalankan(`DELETE FROM HasilPotong WHERE id = ?`, [b.id]);
      tulisRiwayat({
        hasilPotongId: b.id,
        aksi: "HAPUS",
        modelId: b.modelId,
        warnaId: b.warnaId,
        ukuran: (toLabelUkuran(b.ukuran) ?? b.ukuran) as UkuranLabel,
        jumlahLama: b.jumlah,
      });
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  await simpanDb();
  return baris.length;
}

// Tipe riwayat untuk konsumsi.
export type BarisRiwayat = {
  id: number;
  aksi: "BUAT" | "UBAH" | "HAPUS";
  modelNama: string;
  pemilikNama: string;
  warnaNama: string;
  ukuran: UkuranLabel;
  jumlahLama: number | null;
  jumlahBaru: number | null;
  waktu: Date;
};