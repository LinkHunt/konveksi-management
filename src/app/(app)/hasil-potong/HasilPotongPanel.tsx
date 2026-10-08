"use client";

import { useState } from "react";
import { Alert, Card } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, Select, NumberInput } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Table, Td, Th, TableWrap } from "@/components/ui/Table";
import TombolEkspor from "@/components/ui/TombolEkspor";
import { namaFileModel, namaFileTanggal } from "@/lib/ekspor-tabel";
import WarnaBlock, {
  kosongkanSemua,
  totalPcs,
  type BlokWarna,
} from "@/components/forms/WarnaBlock";
import { UKURAN_LIST } from "@/lib/ukuran";
import {
  daftarHasilPotong,
  riwayatHasilPotong,
  simpanHasilPotong,
  koreksiHasilPotong,
  hapusHasilPotong,
  hapusHasilPotongModel,
  type BarisHasilPotong,
  type HasilPotongPerModel,
  type BarisRiwayat,
} from "@/lib/hasil-potong";
import { pesanError } from "@/lib/api";
import { getDb } from "@/lib/db";

/*
 * Panel hasil potong: daftar per model + form entri + aksi per baris
 * (koreksi / hapus / riwayat) + ekspor gambar.
 *
 * Mutasi dipanggil langsung dari lib (menulis sql.js + simpan file), lalu
 * daftar di-refresh dengan membaca lib lagi. Tidak ada API HTTP.
 *
 * Grid: satu baris per warna, satu kolom per ukuran. Sel yang berisi angka
 * tidak diklik (jumlah), tapi tombol koreksi/hapus/riwayat muncul per warna
 * di kolom aksi, menarget baris warna + ukuran yang dipilih lewat Select
 * ukuran di dalam dialog.
 */

type ModelOpsi = {
  id: number;
  nama: string;
  pemilikId: number;
  pemilik: { id: number; nama: string };
};
type WarnaOpsi = { id: number; nama: string; aktif: boolean };

function Sel({
  b,
  onClick,
}: {
  b: BarisHasilPotong | undefined;
  onClick: (b: BarisHasilPotong) => void;
}) {
  if (!b)
    return (
      <Td align="center" className="text-teks-sangat-lembut">
        -
      </Td>
    );
  return (
    <Td align="center">
      <button
        type="button"
        onClick={() => onClick(b)}
        className="rounded px-1.5 py-0.5 font-medium tabular-nums text-aksen hover:bg-aksen-lembut"
        title="Klik untuk koreksi, hapus, atau lihat riwayat"
      >
        {b.jumlah}
      </button>
    </Td>
  );
}

export default function HasilPotongPanel({
  awal,
  modelAwal,
  warnaAwal,
}: {
  awal: HasilPotongPerModel[];
  modelAwal: ModelOpsi[];
  warnaAwal: WarnaOpsi[];
}) {
  const [daftarBaris, setDaftarBaris] = useState<HasilPotongPerModel[]>(awal);
  const [muatGagal, setMuatGagal] = useState<string | null>(null);

  // ---- form entri ----
  const [modelId, setModelId] = useState("");
  const [blok, setBlok] = useState<BlokWarna[]>(kosongkanSemua());
  const [simpanGagal, setSimpanGagal] = useState<string | null>(null);
  const [sedangSimpan, setSedangSimpan] = useState(false);

  // ---- aksi per baris ----
  const [target, setTarget] = useState<BarisHasilPotong | null>(null);
  const [nadaAksi, setNadaAksi] = useState<"koreksi" | "hapus" | "riwayat" | "hapusModel">(
    "koreksi",
  );
  const [targetModel, setTargetModel] = useState<HasilPotongPerModel | null>(null);
  const [koreksiNilai, setKoreksiNilai] = useState("");
  const [aksiGagal, setAksiGagal] = useState<string | null>(null);
  const [sedangAksi, setSedangAksi] = useState(false);
  const [riwayat, setRiwayat] = useState<BarisRiwayat[] | null>(null);

  function muat() {
    try {
      setDaftarBaris(daftarHasilPotong(getDb(), {}));
      setMuatGagal(null);
    } catch (e) {
      setMuatGagal(pesanError(e));
    }
  }

  async function tambah(e: React.FormEvent) {
    e.preventDefault();
    const mid = Number(modelId);
    if (!Number.isInteger(mid) || mid <= 0) return;
    setSedangSimpan(true);
    setSimpanGagal(null);

    const baris = blok.flatMap((b) => {
      const warnaId = Number(b.warnaId);
      if (!Number.isInteger(warnaId) || warnaId <= 0) return [];
      return b.baris
        .filter((x) => x.jumlah !== "")
        .map((x) => ({ warnaId, ukuran: x.ukuran, jumlah: Number(x.jumlah) || 0 }));
    });

    try {
      await simpanHasilPotong({ modelId: mid, baris });
      setModelId("");
      setBlok(kosongkanSemua());
      muat();
    } catch (e) {
      setSimpanGagal(pesanError(e));
    }
    setSedangSimpan(false);
  }

  const totalForm = totalPcs(blok);

  // ---- dialog aksi ----

  function buka(b: BarisHasilPotong, nada: "koreksi" | "hapus" | "riwayat") {
    setTarget(b);
    setTargetModel(null);
    setNadaAksi(nada);
    setAksiGagal(null);
    setKoreksiNilai(String(b.jumlah));
    setRiwayat(null);
    if (nada === "riwayat") muatRiwayat(b);
  }

  /** Konfirmasi hapus seluruh baris satu model (semua warna + ukuran). */
  function bukaHapusModel(m: HasilPotongPerModel) {
    setTarget(null);
    setTargetModel(m);
    setNadaAksi("hapusModel");
    setAksiGagal(null);
    setRiwayat(null);
  }

  async function muatRiwayat(b: BarisHasilPotong) {
    try {
      setRiwayat(riwayatHasilPotong(getDb(), b.id));
    } catch (e) {
      setAksiGagal(pesanError(e));
    }
  }

  async function jalankanAksi() {
    if (!target && !targetModel) return;
    setSedangAksi(true);
    setAksiGagal(null);
    try {
      if (nadaAksi === "koreksi" && target) {
        const nilai = Number(koreksiNilai);
        await koreksiHasilPotong(target.id, nilai);
        setTarget(null);
        muat();
      } else if (nadaAksi === "hapus" && target) {
        await hapusHasilPotong(target.id);
        setTarget(null);
        muat();
      } else if (nadaAksi === "hapusModel" && targetModel) {
        await hapusHasilPotongModel(targetModel.modelId);
        setTarget(null);
        setTargetModel(null);
        muat();
      } else {
        // riwayat = hanya baca
        setTarget(null);
        setTargetModel(null);
      }
    } catch (e) {
      setAksiGagal(pesanError(e));
    }
    setSedangAksi(false);
  }

  // ---- ekspor ----
  /**
   * Bangun data ekspor untuk SATU model: kolom dengan Model/Pemilik (bukan
   * perlu dibungkus ke bawah), baris warna, dan judul yang menyebut modelnya.
   */
  function dataEksporModel(m: HasilPotongPerModel) {
    const kolom = [
      { label: "Warna", lebarMin: 90 },
      ...UKURAN_LIST.map((u) => ({ label: u, align: "center" as const, lebarMin: 36 })),
      { label: "Total", align: "right" as const, lebarMin: 56 },
    ];
    const baris: (string | number | null)[][] = [];
    for (const w of m.warna) {
      const perUkuran = new Map<string, number>();
      for (const b of w.baris) perUkuran.set(b.ukuran, b.jumlah);
      baris.push([w.warnaNama, ...UKURAN_LIST.map((u) => perUkuran.get(u) ?? null), w.subtotal]);
    }
    return {
      judul: `Hasil Potong · ${m.modelNama}`,
      subjudul: m.pemilikNama,
      kolom,
      baris,
      catatan: "Per model + warna + ukuran. Total = jumlah potongan.",
    };
  }

  /** Ekspor seluruh daftar sebagai satu gambar (dipakai tombol utama). */
  function siapkanEkspor() {
    const kolom = [
      { label: "Model", lebarMin: 110 },
      { label: "Warna", lebarMin: 90 },
      { label: "Pemilik", lebarMin: 110 },
      ...UKURAN_LIST.map((u) => ({ label: u, align: "center" as const, lebarMin: 36 })),
      { label: "Total", align: "right" as const, lebarMin: 56 },
    ];
    const baris: (string | number | null)[][] = [];
    for (const m of daftarBaris) {
      for (const w of m.warna) {
        const perUkuran = new Map<string, number>();
        for (const b of w.baris) perUkuran.set(b.ukuran, b.jumlah);
        baris.push([
          m.modelNama,
          w.warnaNama,
          m.pemilikNama,
          ...UKURAN_LIST.map((u) => perUkuran.get(u) ?? null),
          w.subtotal,
        ]);
      }
    }
    return {
      judul: "Hasil Potong",
      kolom,
      baris,
      catatan: "Per model + warna + ukuran. Total = jumlah potongan.",
    };
  }

  const dialogTerbuka = target !== null || targetModel !== null;
  const judulDialog =
    target && nadaAksi === "koreksi"
      ? `Koreksi ${target.warnaNama} ukuran ${target.ukuran}`
      : target && nadaAksi === "hapus"
        ? "Hapus hasil potong?"
        : nadaAksi === "hapusModel"
          ? "Hapus semua hasil potong model ini?"
          : "Riwayat perubahan";

  return (
    <>
      {muatGagal ? (
        <div className="mb-4">
          <Alert tone="error">{muatGagal}</Alert>
        </div>
      ) : null}

      {/* Form entri */}
      <Card className="mb-5">
        <h2 className="mb-3 text-sm font-semibold">Catat hasil potong</h2>
        <form onSubmit={tambah} className="flex flex-col gap-4">
          <Field label="Model baju" htmlFor="model">
            <Select id="model" value={modelId} onChange={(e) => setModelId(e.target.value)} required>
              <option value="">Pilih model</option>
              {modelAwal.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nama} ({m.pemilik.nama})
                </option>
              ))}
            </Select>
          </Field>

          <WarnaBlock
            blok={blok}
            semua={warnaAwal}
            onUbah={setBlok}
            onTambah={() =>
              setBlok((x) => [
                ...x,
                { warnaId: "", baris: UKURAN_LIST.map((u) => ({ ukuran: u, jumlah: "" })) },
              ])
            }
            onHapus={(i) => setBlok((x) => x.filter((_, j) => j !== i))}
          />

          {totalForm > 0 ? (
            <p className="text-sm text-teks-lembut">
              Total: <span className="font-semibold text-teks">{totalForm}</span> pcs
            </p>
          ) : null}
          {simpanGagal ? <Alert tone="error">{simpanGagal}</Alert> : null}

          <div>
            <Button type="submit" variant="primary" disabled={sedangSimpan || !modelId}>
              {sedangSimpan ? "Menyimpan..." : "Simpan hasil potong"}
            </Button>
            <p className="mt-2 text-xs text-teks-lembut">
              Kombinasi model + warna + ukuran yang sudah ada akan ditimpa (dengan riwayat).
              Baris dengan jumlah 0 dibuang otomatis.
            </p>
          </div>
        </form>
      </Card>

      {/* Daftar */}
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            Daftar hasil potong {daftarBaris.length > 0 ? `(${daftarBaris.length} model)` : ""}
          </h2>
          <TombolEkspor namaFile={namaFileTanggal("hasil-potong")} siapkan={siapkanEkspor}>
            Ekspor gambar
          </TombolEkspor>
        </div>

        {daftarBaris.length === 0 ? (
          <p className="py-8 text-center text-sm text-teks-lembut">
            Belum ada hasil potongan. Catat lewat form di atas.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {daftarBaris.map((m) => (
              <section key={m.modelId} className="rounded-lg border border-garis bg-permukaan-2 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{m.modelNama}</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm text-teks-lembut">
                      {m.pemilikNama} · total{" "}
                      <span className="font-semibold text-teks">{m.total}</span> pcs
                    </p>
                    <div className="flex gap-1.5">
                      <TombolEkspor siapkan={() => dataEksporModel(m)} namaFile={namaFileModel("hasil-potong", m.modelNama)}>
                        Foto model
                      </TombolEkspor>
                      <Button variant="danger" size="sm" onClick={() => bukaHapusModel(m)}>
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                          aria-hidden
                        >
                          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
                        </svg>
                        Hapus
                      </Button>
                    </div>
                  </div>
                </div>
                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <Th>Warna</Th>
                        {UKURAN_LIST.map((u) => (
                          <Th key={u} align="center">
                            {u}
                          </Th>
                        ))}
                        <Th align="right">Subtotal</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.warna.map((w) => {
                        const perUkuran = new Map<string, BarisHasilPotong>();
                        for (const b of w.baris) perUkuran.set(b.ukuran, b);
                        return (
                          <tr key={`${m.modelId}-${w.warnaId}`}>
                            <Td className="whitespace-nowrap font-medium">{w.warnaNama}</Td>
                            {UKURAN_LIST.map((u) => (
                              <Sel
                                key={u}
                                b={perUkuran.get(u)}
                                onClick={(b) => buka(b, "koreksi")}
                              />
                            ))}
                            <Td align="right" className="font-semibold tabular-nums">
                              {w.subtotal}
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </TableWrap>
                <p className="mt-2 text-xs text-teks-lembut">
                  Klik angka untuk mengoreksi, menghapus, atau melihat riwayat baris itu.
                </p>
              </section>
            ))}
          </div>
        )}
      </Card>

      {/* Dialog aksi per baris */}
      <ConfirmDialog
        open={dialogTerbuka}
        title={judulDialog}
        message={
          <div className="flex flex-col gap-3">
            {aksiGagal ? <Alert tone="error">{aksiGagal}</Alert> : null}

            {nadaAksi === "koreksi" ? (
              <>
                <Field label="Jumlah baru" htmlFor="koreksi-jumlah">
                  <NumberInput
                    id="koreksi-jumlah"
                    value={koreksiNilai}
                    onChange={(e) => setKoreksiNilai(e.target.value)}
                    min={0}
                  />
                </Field>
                <p className="text-xs text-teks-lembut">
                  Tidak bisa turun di bawah jumlah yang sudah disetor untuk kombinasi ini.
                </p>
              </>
            ) : null}

            {nadaAksi === "hapus" ? (
              <p className="text-sm">
                {target ? `${target.warnaNama} ukuran ${target.ukuran} (${target.jumlah} pcs).` : ""}{" "}
                Riwayat perubahan tetap tersimpan. Kombinasi yang sudah disetor tidak bisa
                dihapus.
              </p>
            ) : null}

            {nadaAksi === "hapusModel" ? (
              <p className="text-sm">
                {targetModel
                  ? `${targetModel.modelNama} (${targetModel.warna.length} warna, total ${targetModel.total} pcs).`
                  : ""}{" "}
                Semua baris warna + ukuran model ini akan dihapus. Riwayat tetap tersimpan.
                Kombinasi yang sudah disetor tidak bisa dihapus.
              </p>
            ) : null}

            {nadaAksi === "riwayat" ? (
              <div className="flex flex-col gap-2">
                {riwayat === null ? (
                  <p className="text-sm text-teks-lembut">Memuat riwayat...</p>
                ) : riwayat.length === 0 ? (
                  <p className="text-sm text-teks-lembut">Belum ada perubahan untuk baris ini.</p>
                ) : (
                  riwayat.map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-col gap-1 rounded-lg border border-garis bg-permukaan-2 p-2.5 text-sm"
                    >
                      <span className="flex items-center justify-between">
                        <BadgeAksi aksi={r.aksi} />
                        <span className="text-xs text-teks-lembut">
                          {new Date(r.waktu).toLocaleString("id-ID", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                      </span>
                      <span>
                        {r.jumlahLama === null
                          ? `Baru dicatat: ${r.jumlahBaru} pcs`
                          : r.jumlahBaru === null
                            ? `Dihapus (sebelumnya ${r.jumlahLama} pcs)`
                            : `${r.jumlahLama} -> ${r.jumlahBaru} pcs`}
                      </span>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>
        }
        confirmLabel={
          nadaAksi === "riwayat" ? "Tutup" : nadaAksi === "hapusModel" ? "Hapus semua" : "Simpan"
        }
        busy={sedangAksi}
        onConfirm={jalankanAksi}
        onCancel={() => {
          if (sedangAksi) return;
          setTarget(null);
          setTargetModel(null);
        }}
      />
    </>
  );
}

function BadgeAksi({ aksi }: { aksi: "BUAT" | "UBAH" | "HAPUS" }) {
  const cls =
    aksi === "HAPUS"
      ? "bg-bahaya-lembut text-bahaya"
      : aksi === "UBAH"
        ? "bg-peringatan-lembut text-peringatan"
        : "bg-sukses-lembut text-sukses";
  const label = aksi === "BUAT" ? "Dibuat" : aksi === "UBAH" ? "Diubah" : "Dihapus";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}