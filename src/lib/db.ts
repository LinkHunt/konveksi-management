// Lapisan database lokal (sql.js/WASM) untuk aplikasi Android offline.
//
// Data disimpan di SATU file SQLite di dalam HP, dibaca/tulis lewat
// @capacitor/filesystem. Aplikasi ini tidak lagi server/API/hosting: seluruh
// data berada di perangkat bibi.
//
// Catatan penting:
// - sql.js = SQLite dikompilasi ke WASM, jalan murni di WebView. Tidak ada
//   proses eksternal / server lokal.
// - Database dipegang di memori (satu instance global), lalu disinkronkan ke
//   disk lewat `simpanDb()` setelah tiap mutasi penting.
// - File .db disimpan di Filesystem direktori aplikasi (getFilesDirectory()).
//   Backup/restore diarahkan ke sini.
// - Ukuran disimpan sebagai TEXT (label 'XS'..'8L'), bukan enum seperti dulu.
//   Schema SQLite pakai TEXT karena tidak ada konsep enum di SQLite.

import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import { Filesystem, Directory } from "@capacitor/filesystem";
// Vite menjaga URL file wasm lewat `?url` (disalin ke dist/ dan diberi nama
// hash). `locateFile` di bawah memakai ini supaya @capacitor/filesystem tidak
// perlu tahu lokasi wasm.
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";

export const NAMA_FILE_DB = "konveksi.db";

let db: Database | null = null;
let SQL: SqlJsStatic | null = null;
let sqlPromise: Promise<SqlJsStatic> | null = null;

/** Inisialisasi sql.js, cache promise supaya sekali saja. */
function initSql(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: () => sqlWasmUrl,
    }).then((mod) => {
      SQL = mod;
      return mod;
    });
  }
  return sqlPromise;
}

/** Uint8Array -> base64 tanpa meledakkan stack (loop per 0x8000 byte). */
function bytesKeBase64(bytes: Uint8Array): string {
  let biner = "";
  const K = 0x8000;
  for (let i = 0; i < bytes.length; i += K) {
    biner += String.fromCharCode(...bytes.subarray(i, i + K));
  }
  return btoa(biner);
}

/** Baca file .db dari disk sebagai Uint8Array; null kalau belum ada. */
async function bacaDariDisk(): Promise<Uint8Array | null> {
  try {
    const res = await Filesystem.readFile({
      path: NAMA_FILE_DB,
      directory: Directory.Data,
    });
    // Capacitor mengembalikan base64 string (web) atau DataParts (Android/iOS).
    if (typeof res.data === "string") return decodeBase64(res.data);
    if (res.data instanceof Blob) {
      return new Uint8Array(await res.data.arrayBuffer());
    }
    if (typeof (res.data as { base64?: string })?.base64 === "string") {
      return decodeBase64((res.data as { base64: string }).base64);
    }
    return null;
  } catch {
    return null; // belum ada file / error baca -> dianggap kosong
  }
}

/** Tulis seluruh database ke file di disk (atomic: tulis file baru lalu ganti). */
export async function simpanDb(): Promise<void> {
  if (!db) return;
  const data = db.export();
  const base64 = bytesKeBase64(data);
  // Tulis ke file temporer lalu rename, supaya app crash di tengah tidak
  // meninggalkan file .db yang korup.
  const tmp = `${NAMA_FILE_DB}.tmp`;
  await Filesystem.writeFile({
    path: tmp,
    data: base64,
    directory: Directory.Data,
    recursive: true,
  });
  await Filesystem.deleteFile({ path: NAMA_FILE_DB, directory: Directory.Data }).catch(
    () => {},
  );
  await Filesystem.rename({ from: tmp, to: NAMA_FILE_DB, directory: Directory.Data });
}

/** Ambil instance database aktif (harus sudah `initDb`). */
export function getDb(): Database {
  if (!db) throw new Error("Database belum diinisialisasi. Panggil initDb() dulu.");
  return db;
}

/** Jalankan statement `db.run` biasa (tanpa hasil). */
export function jalankan(sql: string, params?: unknown[]): void {
  getDb().run(sql, params as never);
}

/** Inisialisasi skema SQLite (CREATE TABLE IF NOT EXISTS + index). */
function initSchema(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS Pemilik (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      nama  TEXT NOT NULL UNIQUE,
      aktif INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS Warna (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      nama  TEXT NOT NULL UNIQUE,
      aktif INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS ModelBaju (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      nama      TEXT NOT NULL,
      pemilikId INTEGER NOT NULL REFERENCES Pemilik(id),
      aktif     INTEGER NOT NULL DEFAULT 1,
      UNIQUE(pemilikId, nama)
    );

    CREATE TABLE IF NOT EXISTS HasilPotong (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      modelId   INTEGER NOT NULL REFERENCES ModelBaju(id),
      warnaId   INTEGER NOT NULL REFERENCES Warna(id),
      ukuran    TEXT NOT NULL,
      jumlah    INTEGER NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT,
      UNIQUE(modelId, warnaId, ukuran)
    );

    CREATE TABLE IF NOT EXISTS HasilPotongRiwayat (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      hasilPotongId INTEGER NOT NULL,
      aksi          TEXT NOT NULL,      -- BUAT | UBAH | HAPUS
      modelId       INTEGER NOT NULL,
      warnaId       INTEGER NOT NULL,
      ukuran        TEXT NOT NULL,
      jumlahLama    INTEGER,
      jumlahBaru    INTEGER,
      createdAt     TEXT NOT NULL DEFAULT (datetime('now'))
      -- sengaja TANPA FK: riwayat tetap ada setelah baris asal dihapus
    );

    CREATE TABLE IF NOT EXISTS Setoran (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      tanggal   TEXT NOT NULL,           -- 'YYYY-MM-DD'
      catatan   TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS SetoranItem (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      setoranId INTEGER NOT NULL REFERENCES Setoran(id) ON DELETE CASCADE,
      modelId   INTEGER NOT NULL,
      warnaId   INTEGER NOT NULL,
      ukuran    TEXT NOT NULL,
      jumlah    INTEGER NOT NULL,
      UNIQUE(setoranId, modelId, warnaId, ukuran)
    );

    CREATE INDEX IF NOT EXISTS idx_potong_model  ON HasilPotong(modelId);
    CREATE INDEX IF NOT EXISTS idx_potong_warna  ON HasilPotong(warnaId);
    CREATE INDEX IF NOT EXISTS idx_riwayat_potong ON HasilPotongRiwayat(hasilPotongId);
    CREATE INDEX IF NOT EXISTS idx_setoran_tanggal ON Setoran(tanggal);
    CREATE INDEX IF NOT EXISTS idx_setoritem_kombo ON SetoranItem(modelId, warnaId, ukuran);
  `);
}

/**
 * Inisialisasi database. Dipanggil sekali di awal app (main entry).
 * Mengembalikan instance aktif.
 */
export async function initDb(): Promise<Database> {
  await initSql(); // pastikan modul WASM siap
  const dariDisk = await bacaDariDisk();
  db = dariDisk ? new SQL!.Database(dariDisk) : new SQL!.Database();
  initSchema(db);
  return db;
}

/** true kalau database sudah siap dipakai. */
export function dbSiap(): boolean {
  return db !== null;
}

/** Hapus seluruh isi tabel (dipakai saat import DB baru / reset). */
export function kosongkanSemua(): void {
  getDb().exec(`
    DELETE FROM HasilPotongRiwayat;
    DELETE FROM SetoranItem;
    DELETE FROM Setoran;
    DELETE FROM HasilPotong;
    DELETE FROM ModelBaju;
    DELETE FROM Warna;
    DELETE FROM Pemilik;
  `);
}

/** Ekspor DB sebagai base64 string (dipakai fitur backup). */
export function eksporBase64(): string {
  return bytesKeBase64(getDb().export());
}

/**
 * Ganti seluruh database dari file base64 (dipakai fitur restore).
 * Harus berjalan ASYNC dan sudah `initSql()` dijamin siap.
 */
export async function gantiDb(dariBase64: string): Promise<void> {
  await initSql();
  const bin = decodeBase64(dariBase64);
  if (db) db.close();
  db = new SQL!.Database(bin);
  initSchema(db);
}

/** base64 -> Uint8Array (decoder btoa/generator). */
function decodeBase64(b64: string): Uint8Array {
  const biner = atob(b64);
  const bytes = new Uint8Array(biner.length);
  for (let i = 0; i < biner.length; i++) bytes[i] = biner.charCodeAt(i);
  return bytes;
}

/** Helper hasil SELECT: kembalikan array of rows sebagai objek biasa. */
export function semua<T = Record<string, unknown>>(st: string, params?: unknown[]): T[] {
  const res = getDb().exec(st, params as never);
  if (res.length === 0) return [];
  const { columns, values } = res[0];
  return values.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj as T;
  });
}

/** Helper hasil SELECT: satu baris pertama, null kalau kosong. */
export function satu<T = Record<string, unknown>>(st: string, params?: unknown[]): T | null {
  return semua<T>(st, params)[0] ?? null;
}