"use client";

import { useRef, useState } from "react";
import { Alert, Card, PageHeader } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { eksporBase64, gantiDb, simpanDb, NAMA_FILE_DB } from "@/lib/db";
import { pesanError } from "@/lib/api";
import { Filesystem, Directory } from "@capacitor/filesystem";

/*
 * Cadangkan & pulihkan data.
 *
 * Backup: seluruh database (satu file .db) ditulis ke folder Dokumen di HP
 * lewat @capacitor/filesystem, supaya bisa diambil lewat file manager lalu
 * disalin ke tempat lain (Google Drive, dll).
 *
 * Restore: pilih file .db lewat picker (input file), isi database diganti
 * dengan isi file itu, lalu simpan. Seluruh data lama yang perangkat bibi
 * OTOMATIS DITIMPA — tidak ada konfirmasi berlapis dari aplikasi selain
 * dialog di sini.
 */

function namaDefault(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${NAMA_FILE_DB.replace(".db", "")}-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.db`;
}

export default function BackupRestorePage() {
  const [info, setInfo] = useState<string | null>(null);
  const [gagal, setGagal] = useState<string | null>(null);
  const [sedang, setSedang] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function cadangkan() {
    setSedang(true);
    setGagal(null);
    setInfo(null);
    try {
      const base64 = eksporBase64();
      const path = "Cadangan/" + namaDefault();
      await Filesystem.writeFile({
        path,
        data: base64,
        directory: Directory.Documents,
        recursive: true,
      });
      setInfo(`Berhasil. File tersimpan di folder Dokumen/Cadangan (${path.replace("Cadangan/", "")}).`);
    } catch (e) {
      setGagal(pesanError(e));
    }
    setSedang(false);
  }

  async function pilihFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // izinkan pilih file sama lagi setelah selesai
    if (!file) return;
    setSedang(true);
    setGagal(null);
    setInfo(null);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      // btoa(Array.from(...).join("")) meledakkan stack untuk file besar;
      // sama seperti bug lama di bytesKeBase64. Loop per 0x8000 byte.
      let biner = "";
      const K = 0x8000;
      for (let i = 0; i < buf.length; i += K) {
        biner += String.fromCharCode(...buf.subarray(i, i + K));
      }
      const base64 = btoa(biner);
      await gantiDb(base64);
      await simpanDb();
      setInfo("Berhasil dimuat. Memuat ulang aplikasi...");
      // Semua halaman lain menahan state lama (useMemo db); muat ulang biar
      // konsisten.
      window.setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      setGagal(pesanError(err));
    }
    setSedang(false);
  }

  return (
    <>
      <PageHeader
        title="Cadangan & Pulihkan"
        description="Simpan seluruh data ke satu file .db, atau isi lagi dari file cadangan."
      />

      <div className="flex flex-col gap-4">
        <Card>
          <h2 className="mb-1 text-sm font-semibold">Buat cadangan</h2>
          <p className="mb-3 text-sm text-teks-lembut">
            Menulis satu file .db berisi seluruh data (pemilik, model, warna,
            hasil potong, setoran, riwayat) ke folder Dokumen/Cadangan di HP.
          </p>
          <Button variant="primary" onClick={cadangkan} disabled={sedang}>
            {sedang ? "Menyimpan..." : "Simpan cadangan"}
          </Button>
        </Card>

        <Card>
          <h2 className="mb-1 text-sm font-semibold">Pulihkan dari cadangan</h2>
          <p className="mb-3 text-sm text-teks-lembut">
            Pilih file .db cadangan. Seluruh data yang ada sekarang{" "}
            <span className="font-semibold">akan ditimpa</span> oleh isi file itu,
            lalu aplikasi dimuat ulang.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".db,application/octet-stream"
            onChange={pilihFile}
            className="hidden"
          />
          <Button variant="secondary" disabled={sedang} onClick={() => fileRef.current?.click()}>
            {sedang ? "Memproses..." : "Pilih file .db"}
          </Button>
        </Card>

        {info ? <Alert tone="success">{info}</Alert> : null}
        {gagal ? <Alert tone="error">{gagal}</Alert> : null}
      </div>
    </>
  );
}