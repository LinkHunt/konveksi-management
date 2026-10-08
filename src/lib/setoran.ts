// Logika setoran ke atasan untuk aplikasi offline (sql.js).
//
// Setoran TIDAK boleh melebihi hasil potongan (sumber data yang benar).
// Saat simpan, tiap kombinasi model+warna+ukuran divalidasi:
//   target          = hasil potong (nilai terbaru)
//   sudahSetorLain  = SUM setoran lain (kecuali setoran yang sedang diedit)
//   diizinkan       = jumlahBaru <= target - sudahSetorLain
//
// Pemilik tidak disimpan di tabel setoran: cukup ikut dari ModelBaju.

import { semua, satu, jalankan, getDb, simpanDb } from "./db";
import { toLabelUkuran, type UkuranLabel } from "./ukuran";
import { badRequest, notFound } from "./api";

export type BarisSetoranItem = {
  modelId: number;
  modelNama: string;
  pemilikNama: string;
  warnaId: number;
  warnaNama: string;
  ukuran: UkuranLabel;
  jumlah: number;
};

export type DetailSetoran = {
  id: number;
  tanggal: string;
  catatan: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: BarisSetoranItem[];
  totalPcs: number;
};

export type RingkasanSetoran = {
  id: number;
  tanggal: string;
  catatan: string | null;
  totalPcs: number;
  jumlahItem: number;
};

/** Query dasar item setoran + join model/pemilik/warna. */
function queryItems(setoranId?: number): BarisSetoranItem[] {
  const rows = semua<{
    modelId: number;
    modelNama: string;
    pemilikNama: string;
    warnaId: number;
    warnaNama: string;
    ukuran: string;
    jumlah: number;
  }>(
    `
    SELECT
      si.modelId,
      m.nama  AS modelNama,
      p.nama  AS pemilikNama,
      si.warnaId,
      w.nama  AS warnaNama,
      si.ukuran,
      si.jumlah
    FROM SetoranItem si
    JOIN ModelBaju m ON m.id = si.modelId
    JOIN Pemilik p  ON p.id = m.pemilikId
    JOIN Warna w    ON w.id = si.warnaId
    ${setoranId !== undefined ? "WHERE si.setoranId = ?" : ""}
    ORDER BY si.modelId, si.warnaId
    `,
    setoranId !== undefined ? [setoranId] : [],
  );
  return rows.map((r) => ({
    modelId: r.modelId,
    modelNama: r.modelNama,
    pemilikNama: r.pemilikNama,
    warnaId: r.warnaId,
    warnaNama: r.warnaNama,
    ukuran: (toLabelUkuran(r.ukuran) ?? r.ukuran) as UkuranLabel,
    jumlah: r.jumlah,
  }));
}

function keRingkasan(s: { id: number; tanggal: string; catatan: string | null }): RingkasanSetoran {
  const items = queryItems(s.id);
  return {
    id: s.id,
    tanggal: s.tanggal,
    catatan: s.catatan,
    totalPcs: items.reduce((a, i) => a + i.jumlah, 0),
    jumlahItem: items.length,
  };
}

/** Daftar setoran, terbaru dulu, dengan total pcs & jumlah item. */
export function daftarSetoran(
  filter: { tanggal?: string; limit?: number } = {},
): RingkasanSetoran[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tanggal) {
    where.push("s.tanggal = ?");
    params.push(filter.tanggal);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const limitSql = filter.limit !== undefined ? `LIMIT ${filter.limit}` : "";
  const rows = semua<{ id: number; tanggal: string; catatan: string | null }>(
    `SELECT id, tanggal, catatan FROM Setoran s ${whereSql} ORDER BY s.tanggal DESC, s.id DESC ${limitSql}`,
    params,
  );
  return rows.map((r) => keRingkasan(r));
}

/** Satu setoran lengkap dengan item. */
export function detailSetoran(id: number): DetailSetoran | null {
  const s = satu<{ id: number; tanggal: string; catatan: string | null; createdAt: string; updatedAt: string }>(
    `SELECT id, tanggal, catatan, createdAt, updatedAt FROM Setoran WHERE id = ?`,
    [id],
  );
  if (!s) return null;
  const items = queryItems(id);
  return {
    id: s.id,
    tanggal: s.tanggal,
    catatan: s.catatan,
    createdAt: new Date(s.createdAt ?? 0),
    updatedAt: new Date(s.updatedAt ?? 0),
    items,
    totalPcs: items.reduce((a, i) => a + i.jumlah, 0),
  };
}

/**
 * Simpan setoran: validasi melebihi target + simpan item dalam satu transaksi.
 * `setoranId` diisi saat PUT (setoran yang diedit dikecualikan).
 */
export async function simpanSetoran(input: {
  tanggal: string;
  catatan?: string | null;
  items: { modelId: number; warnaId: number; ukuran: UkuranLabel; jumlah: number }[];
  setoranId?: number;
}): Promise<number> {
  // Buang baris 0-/negatif.
  const daftar = input.items.filter((i) => Number.isInteger(i.jumlah) && i.jumlah > 0);
  if (daftar.length === 0) {
    throw badRequest(
      "Minimal satu baris model, warna, dan ukuran dengan jumlah lebih dari 0.",
    );
  }
  // Tanggal valid.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.tanggal)) {
    throw badRequest("Tanggal harus format YYYY-MM-DD.");
  }

  const db = getDb();

  // Deteksi kombinasi duplikat dalam payload.
  const kotakKunci = daftar.map((i) => `${i.modelId}|${i.warnaId}|${i.ukuran}`);
  const kelompok = new Map<string, (typeof daftar)[number]>();
  for (let i = 0; i < kotakKunci.length; i++) {
    const k = kotakKunci[i];
    if (kelompok.has(k)) {
      throw badRequest(
        `Baris ${daftar[i].modelId} ${daftar[i].warnaId} ${daftar[i].ukuran} muncul lebih dari sekali. Gabungkan jumlahnya jadi satu baris.`,
      );
    }
    kelompok.set(k, daftar[i]);
  }

  // Target = hasil potong untuk tiap kombinasi.
  const targetMap = new Map<string, number>();
  for (const it of daftar) {
    const t = satu<{ jumlah: number }>(
      `SELECT jumlah FROM HasilPotong WHERE modelId = ? AND warnaId = ? AND ukuran = ?`,
      [it.modelId, it.warnaId, it.ukuran],
    );
    if (t === null) {
      targetMap.set(it.modelId + "|" + it.warnaId + "|" + it.ukuran, 0);
    } else {
      targetMap.set(it.modelId + "|" + it.warnaId + "|" + it.ukuran, t.jumlah);
    }
  }

  // Sudah disetor (kecuali setoran yang diedit) per kombinasi.
  const sudahMap = new Map<string, number>();
  const already = daftar.map((i) =>
    satu<{ total: number | null }>(
      `SELECT SUM(jumlah) AS total FROM SetoranItem
       WHERE modelId = ? AND warnaId = ? AND ukuran = ?
         ${input.setoranId !== undefined ? "AND setoranId != ?" : ""}`,
      input.setoranId !== undefined
        ? [i.modelId, i.warnaId, i.ukuran, input.setoranId]
        : [i.modelId, i.warnaId, i.ukuran],
    ),
  );
  daftar.forEach((it, i) => {
    sudahMap.set(
      `${it.modelId}|${it.warnaId}|${it.ukuran}`,
      already[i]?.total ?? 0,
    );
  });

  // Nama model & warna untuk pesan error.
  const namaModel = new Map<number, string>();
  const namaWarna = new Map<number, string>();
  for (const it of daftar) {
    if (!namaModel.has(it.modelId)) {
      const m = satu<{ nama: string }>(`SELECT nama FROM ModelBaju WHERE id = ?`, [it.modelId]);
      namaModel.set(it.modelId, m?.nama ?? `model #${it.modelId}`);
    }
    if (!namaWarna.has(it.warnaId)) {
      const w = satu<{ nama: string }>(`SELECT nama FROM Warna WHERE id = ?`, [it.warnaId]);
      namaWarna.set(it.warnaId, w?.nama ?? `warna #${it.warnaId}`);
    }
  }

  // Validasi melebihi target.
  for (const [k, item] of kelompok) {
    const target = targetMap.get(k) ?? 0;
    const sudahSetor = sudahMap.get(k) ?? 0;
    const sisaTarget = target - sudahSetor;
    if (item.jumlah > sisaTarget) {
      throw badRequest(
        `Setoran melebihi target untuk ${namaModel.get(item.modelId)} warna ${namaWarna.get(
          item.warnaId,
        )} ukuran ${item.ukuran}: tersisa ${sisaTarget} pcs dari potongan ${target}, yang kamu isi ${item.jumlah}.`,
        {
          modelId: item.modelId,
          warnaId: item.warnaId,
          ukuran: item.ukuran,
          sisaTarget,
          jumlahBaru: item.jumlah,
          target,
        },
      );
    }
  }

  const catatan = input.catatan?.trim() ? input.catatan.trim() : null;
  const tanggal = input.tanggal;

  db.exec("BEGIN");
  let id: number;
  try {
    if (input.setoranId === undefined) {
      // Buat setoran baru.
      jalankan(`INSERT INTO Setoran (tanggal, catatan, createdAt, updatedAt) VALUES (?, ?, datetime('now'), datetime('now'))`, [
        tanggal,
        catatan,
      ]);
      const baru = satu<{ id: number }>(
        `SELECT id FROM Setoran WHERE tanggal = ? ORDER BY id DESC LIMIT 1`,
        [tanggal],
      )!;
      id = baru.id;
      for (const it of daftar) {
        jalankan(
          `INSERT INTO SetoranItem (setoranId, modelId, warnaId, ukuran, jumlah) VALUES (?, ?, ?, ?, ?)`,
          [id, it.modelId, it.warnaId, it.ukuran, it.jumlah],
        );
      }
    } else {
      // Ganti (PUT): hapus item lama, perbarui header, masukkan item baru.
      jalankan(`DELETE FROM SetoranItem WHERE setoranId = ?`, [input.setoranId]);
      jalankan(
        `UPDATE Setoran SET tanggal = ?, catatan = ?, updatedAt = datetime('now') WHERE id = ?`,
        [tanggal, catatan, input.setoranId],
      );
      id = input.setoranId;
      for (const it of daftar) {
        jalankan(
          `INSERT INTO SetoranItem (setoranId, modelId, warnaId, ukuran, jumlah) VALUES (?, ?, ?, ?, ?)`,
          [id, it.modelId, it.warnaId, it.ukuran, it.jumlah],
        );
      }
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  await simpanDb();
  return id;
}

/** Hapus setoran beserta itemnya (item terhapus via ON DELETE CASCADE / manual). */
export async function hapusSetoran(id: number): Promise<void> {
  const db = getDb();
  if (!satu(`SELECT id FROM Setoran WHERE id = ?`, [id])) throw notFound("Setoran tidak ditemukan.");
  db.exec("BEGIN");
  try {
    jalankan(`DELETE FROM SetoranItem WHERE setoranId = ?`, [id]);
    jalankan(`DELETE FROM Setoran WHERE id = ?`, [id]);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  await simpanDb();
}