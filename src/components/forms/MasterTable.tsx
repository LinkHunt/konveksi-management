"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert, Card } from "@/components/ui/Alert";
import { Field, Input, Select } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Table, Td, Th, TableWrap, EmptyRow } from "@/components/ui/Table";
import TombolEkspor from "@/components/ui/TombolEkspor";
import {
  daftar,
  buat,
  ubah,
  namaSudahDipakai,
  jumlahTransaksiMemakai,
  masterSedangDipakai,
  pesanDuplikat,
  type BarisBasic,
  type BarisModel,
} from "@/lib/master";
import { pesanError } from "@/lib/api";
import { getDb } from "@/lib/db";

/*
 * Satu komponen untuk halaman master (pemilik, model, warna). Bedanya cuma:
 * model butuh dropdown pemilik, dan labelnya beda.
 *
 * Master TIDAK punya DELETE. Menonaktifkan dilakukan dengan `aktif: false`
 * supaya data lama tetap utuh. Backend (lib) menolak menonaktifkan master yang
 * masih dipakai hasil potong/setoran, dan pesannya ditampilkan apa adanya.
 *
 * Data dibaca langsung dari database lokal saat render (paginator awal),
 * lalu di-refresh manual dari lib setelah mutasi — bukan fetch HTTP.
 */

type Entitas = "pemilik" | "model" | "warna";

const LABEL: Record<Entitas, string> = {
  pemilik: "Pemilik",
  model: "Model Baju",
  warna: "Warna",
};

export default function MasterTable({
  entity,
  butuhPemilik,
  withPemilik,
  awal,
}: {
  entity: Entitas;
  /** Model wajib punya pemilik. */
  butuhPemilik: boolean;
  withPemilik?: { id: number; nama: string }[];
  /** Data awal, sudah diambil dari lib saat render. */
  awal: (BarisBasic | BarisModel)[];
}) {
  const label = LABEL[entity];

  const [baris, setBaris] = useState<(BarisBasic | BarisModel)[]>(awal);
  const [muatGagal, setMuatGagal] = useState<string | null>(null);
  const [sembunyiNonaktif, setSembunyiNonaktif] = useState(true);

  const [nama, setNama] = useState("");
  const [pemilikId, setPemilikId] = useState("");
  const [simpanGagal, setSimpanGagal] = useState<string | null>(null);
  const [sedangSimpan, setSedangSimpan] = useState(false);

  const [ubahId, setUbahId] = useState<number | null>(null);
  const [ubahNama, setUbahNama] = useState("");
  const [ubahGagal, setUbahGagal] = useState<string | null>(null);

  const [nonaktifTarget, setNonaktifTarget] = useState<BarisBasic | null>(null);
  const [nonaktifGagal, setNonaktifGagal] = useState<string | null>(null);
  // Terpisah dari `sedangSimpan` yang cuma buat form tambah. Kalau dialog
  // nonaktifkan pakai state itu, tombolnya tidak pernah jadi disabled dan
  // request-nya bisa terkirim berulang.
  const [nonaktifProses, setNonaktifProses] = useState(false);

  /** Refresh daftar langsung dari database lokal. */
  function muat() {
    try {
      setBaris(daftar(getDb(), entity, {}));
      setMuatGagal(null);
    } catch (e) {
      setMuatGagal(pesanError(e));
    }
  }

  async function tambah(e: React.FormEvent) {
    e.preventDefault();
    if (!nama.trim()) return;
    setSedangSimpan(true);
    setSimpanGagal(null);
    try {
      const payload = butuhPemilik
        ? { nama: nama.trim(), pemilikId: Number(pemilikId) }
        : { nama: nama.trim() };
      // Validasi duplikat manual dulu untuk pesan ramah.
      const db = getDb();
      if (db && namaSudahDipakai(db, entity, payload.nama, butuhPemilik ? { pemilikId: payload.pemilikId } : {})) {
        setSimpanGagal(pesanDuplikat(entity, payload.nama));
        setSedangSimpan(false);
        return;
      }
      await buat(db, entity, payload);
      setNama("");
      setPemilikId("");
      muat();
    } catch (e) {
      setSimpanGagal(pesanError(e));
    }
    setSedangSimpan(false);
  }

  async function simpanUbah(id: number) {
    setUbahGagal(null);
    try {
      await ubah(getDb(), entity, id, { nama: ubahNama.trim() });
      setUbahId(null);
      muat();
    } catch (e) {
      setUbahGagal(pesanError(e));
    }
  }

  async function ubahAktif(b: BarisBasic) {
    setNonaktifGagal(null);
    setNonaktifProses(true);
    try {
      const db = getDb();
      if (b.aktif) {
        const n = jumlahTransaksiMemakai(db, entity, b.id);
        if (n > 0) {
          setNonaktifGagal(masterSedangDipakai(entity));
          setNonaktifTarget(null);
          setNonaktifProses(false);
          return;
        }
      }
      await ubah(db, entity, b.id, { aktif: !b.aktif });
      setNonaktifTarget(null);
      muat();
    } catch (e) {
      setNonaktifGagal(pesanError(e));
      setNonaktifTarget(null);
    }
    setNonaktifProses(false);
  }

  const tampil = (baris ?? []).filter((b) => (sembunyiNonaktif ? b.aktif : true));
  const jumlahPemilik = withPemilik?.length ?? 0;

  return (
    <>
      <Card className="mb-5">
        <h2 className="mb-3 text-sm font-semibold">Tambah {label}</h2>
        {muatGagal ? (
          <div className="mb-3">
            <Alert tone="error">{muatGagal}</Alert>
          </div>
        ) : null}
        <form onSubmit={tambah} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={`Nama ${label.toLowerCase()}`} htmlFor="nama">
              <Input
                id="nama"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder={`Nama ${label.toLowerCase()}`}
                maxLength={120}
                required
              />
            </Field>
            {butuhPemilik ? (
              <Field label="Pemilik" htmlFor="pemilik">
                <Select
                  id="pemilik"
                  value={pemilikId}
                  onChange={(e) => setPemilikId(e.target.value)}
                  required
                >
                  <option value="">Pilih pemilik</option>
                  {(withPemilik ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nama}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>
          {simpanGagal ? <Alert tone="error">{simpanGagal}</Alert> : null}
          <div>
            <Button
              type="submit"
              variant="primary"
              disabled={sedangSimpan || (butuhPemilik && jumlahPemilik === 0)}
            >
              {sedangSimpan ? "Menyimpan..." : `Tambah ${label}`}
            </Button>
            {butuhPemilik && jumlahPemilik === 0 ? (
              <p className="mt-2 text-xs text-teks-lembut">
                Buat pemilik dulu sebelum menambah model.
              </p>
            ) : null}
          </div>
        </form>
      </Card>

      {nonaktifGagal ? (
        <div className="mb-4">
          <Alert tone="error">{nonaktifGagal}</Alert>
        </div>
      ) : null}
      {ubahGagal ? (
        <div className="mb-4">
          <Alert tone="error">{ubahGagal}</Alert>
        </div>
      ) : null}

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            Daftar {label} {baris ? `(${tampil.length})` : ""}
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-teks-lembut">
              <input
                type="checkbox"
                checked={!sembunyiNonaktif}
                onChange={(e) => setSembunyiNonaktif(!e.target.checked)}
                className="h-4 w-4 rounded border-garis-kuat accent-aksen"
              />
              Tampilkan nonaktif
            </label>
            <TombolEkspor
              namaFile={`daftar-${entity}.png`}
              siapkan={() => ({
                judul: `Daftar ${label}`,
                subjudul: sembunyiNonaktif ? "Hanya data aktif" : "Semua data, termasuk nonaktif",
                kolom: [
                  { label: "Nama" },
                  ...(butuhPemilik ? [{ label: "Pemilik" }] : []),
                  { label: "Status", align: "center" as const },
                ],
                baris: tampil.map((b) => [
                  b.nama,
                  butuhPemilik && "pemilik" in b && b.pemilik ? b.pemilik.nama : null,
                  b.aktif ? "Aktif" : "Nonaktif",
                ]),
                catatan: `Data master ${label.toLowerCase()}`,
              })}
            >
              Ekspor gambar
            </TombolEkspor>
          </div>
        </div>

        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Nama</Th>
                {butuhPemilik ? <Th>Pemilik</Th> : null}
                <Th>Status</Th>
                <Th align="right">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {tampil.length === 0 ? (
                <EmptyRow colSpan={butuhPemilik ? 4 : 3} message={`Belum ada data ${label.toLowerCase()}.`} />
              ) : (
                tampil.map((b) => (
                  <tr key={b.id}>
                    <Td>
                      {ubahId === b.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={ubahNama}
                            onChange={(e) => setUbahNama(e.target.value)}
                            maxLength={120}
                            autoFocus
                            className="max-w-48"
                          />
                          <Button size="sm" variant="primary" onClick={() => simpanUbah(b.id)}>
                            Simpan
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setUbahId(null)}>
                            Batal
                          </Button>
                        </div>
                      ) : (
                        <span className={b.aktif ? "" : "text-teks-lembut line-through"}>{b.nama}</span>
                      )}
                    </Td>
                    {butuhPemilik ? (
                      <Td className="whitespace-nowrap text-teks-lembut">
                        {"pemilik" in b && b.pemilik ? b.pemilik.nama : "-"}
                      </Td>
                    ) : null}
                    <Td>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          b.aktif ? "bg-sukses-lembut text-sukses" : "bg-permukaan-2 text-teks-lembut"
                        }`}
                      >
                        {b.aktif ? "Aktif" : "Nonaktif"}
                      </span>
                    </Td>
                    <Td align="right">
                      {ubahId !== b.id ? (
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setUbahId(b.id);
                              setUbahNama(b.nama);
                            }}
                          >
                            Ubah
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setNonaktifTarget(b);
                              setNonaktifGagal(null);
                            }}
                          >
                            {b.aktif ? "Nonaktifkan" : "Aktifkan"}
                          </Button>
                        </div>
                      ) : null}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </TableWrap>
      </Card>

      <ConfirmDialog
        open={nonaktifTarget !== null}
        title={nonaktifTarget?.aktif ? `Nonaktifkan ${nonaktifTarget.nama}?` : `Aktifkan ${nonaktifTarget?.nama}?`}
        message={
          nonaktifTarget?.aktif
            ? "Data ini tidak akan muncul lagi di pilihan form baru. Kalau masih dipakai hasil potong atau setoran, penonaktifan ditolak."
            : "Data ini akan muncul lagi di pilihan form."
        }
        confirmLabel={nonaktifTarget?.aktif ? "Nonaktifkan" : "Aktifkan"}
        busy={nonaktifProses}
        onConfirm={() => nonaktifTarget && ubahAktif(nonaktifTarget)}
        onCancel={() => !nonaktifProses && setNonaktifTarget(null)}
      />
    </>
  );
}