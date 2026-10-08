"use client";

import { useState } from "react";
import { Alert, Card } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, Select, Input, Textarea, NumberInput } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Table, Td, Th, TableWrap } from "@/components/ui/Table";
import TombolEkspor from "@/components/ui/TombolEkspor";
import { namaFileTanggal } from "@/lib/ekspor-tabel";
import { hariIniWIB } from "@/lib/tanggal";
import {
  daftarSetoran,
  detailSetoran,
  simpanSetoran,
  hapusSetoran,
  type RingkasanSetoran,
  type DetailSetoran,
} from "@/lib/setoran";
import { hitungKurang, kotakKurang, type KotakKurang } from "@/lib/kurang";
import { type UkuranLabel } from "@/lib/ukuran";
import { pesanError } from "@/lib/api";

/*
 * Panel setoran ke atasan: form mencatat/ubah setoran + riwayat + ekspor.
 *
 * Form menampilkan sisa target per model + warna + ukuran (dari hasil potong
 * dikurangi setoran lain), supaya bibi tahu berapa yang boleh disetor. Pustaka
 * tetap menolak kalau melebihi target.
 *
 * Saat model dipilih, target dihitung langsung dari lib (hasil potong - setor),
 * seperti /api/kurang dulu. Isian setoran disimpan per warna+ukuran di `isian`
 * (Map berbentuk objek).
 */

type ModelOpsi = {
  id: number;
  nama: string;
  pemilikId: number;
  pemilik: { id: number; nama: string };
};
type WarnaOpsi = { id: number; nama: string; aktif: boolean };

export default function SetoranPanel({
  modelAwal,
  warnaAwal,
  setoranAwal,
}: {
  modelAwal: ModelOpsi[];
  warnaAwal: WarnaOpsi[];
  setoranAwal: RingkasanSetoran[];
}) {
  // ---- form ----
  const [mode, setMode] = useState<"tambah" | "edit">("tambah");
  const [editId, setEditId] = useState<number | null>(null);
  const [tanggal, setTanggal] = useState(hariIniWIB());
  const [catatan, setCatatan] = useState("");
  const [modelId, setModelId] = useState("");
  const [kotak, setKotak] = useState<KotakKurang[]>([]);
  const [isian, setIsian] = useState<Record<string, string>>({});
  const [muatTargetGagal, setMuatTargetGagal] = useState<string | null>(null);
  const [simpanGagal, setSimpanGagal] = useState<string | null>(null);
  const [sedangSimpan, setSedangSimpan] = useState(false);

  // ---- riwayat ----
  const [riwayat, setRiwayat] = useState<RingkasanSetoran[]>(setoranAwal);
  const [muatRiwayatGagal, setMuatRiwayatGagal] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailSetoran | null>(null);
  const [detailTarget, setDetailTarget] = useState<number | null>(null);
  const [detailGagal, setDetailGagal] = useState<string | null>(null);
  const [hapusTarget, setHapusTarget] = useState<RingkasanSetoran | null>(null);
  const [hapusGagal, setHapusGagal] = useState<string | null>(null);
  const [sedangHapus, setSedangHapus] = useState(false);

  function kunci(warnaId: number, ukuran: string): string {
    return `${warnaId}|${ukuran}`;
  }

  /**
   * Muat target sisa untuk model yang dipilih: hitung langsung dari lib
   * (hasil potong - setoran lain), lalu bungkus jadi kotak kurang.
   *
   * Kombinasi yang sudah lunas disembunyikan supaya form tidak penuh baris
   * yang tidak bisa diisi. Di mode edit, setoran yang sedang dibuka dikirim
   * sebagai `setoranId` supaya DIKECUALIKAN dari hitungan setor — kuotanya
   * kembali utuh, jadi baris yang tadi penuh tetap muncul dan bisa dikoreksi
   * turun.
   */
  function pilihModel(id: string, opts: { setoranId?: number } = {}) {
    setModelId(id);
    setIsian({});
    setMuatTargetGagal(null);
    if (!id) {
      setKotak([]);
      return;
    }
    try {
      const baris = hitungKurang(
        opts.setoranId !== undefined ? { modelId: Number(id), setoranId: opts.setoranId } : { modelId: Number(id) },
      );
      const cek = kotakKurang(baris).filter((k) => !k.selesai);
      setKotak(cek);
    } catch (e) {
      setMuatTargetGagal(pesanError(e));
      setKotak([]);
    }
  }

  /** Pindah ke mode edit: muat detail setoran dan isi form sesuai itemnya. */
  function mulaiUbah(id: number) {
    setMode("edit");
    setEditId(id);
    setSimpanGagal(null);
    setMuatTargetGagal(null);
    setDetailGagal(null);
    try {
      const d = detailSetoran(id);
      if (!d) {
        setDetailGagal("Setoran tidak ditemukan.");
        return;
      }
      setTanggal(d.tanggal);
      setCatatan(d.catatan ?? "");
      const modelItem = d.items[0];
      if (modelItem) {
        pilihModel(String(modelItem.modelId), { setoranId: id });
        const isiMap: Record<string, string> = {};
        for (const it of d.items) {
          isiMap[kunci(it.warnaId, it.ukuran)] = String(it.jumlah);
        }
        setIsian(isiMap);
      } else {
        setModelId("");
        setKotak([]);
        setIsian({});
      }
    } catch (e) {
      setDetailGagal(pesanError(e));
    }
  }

  function resetForm() {
    setMode("tambah");
    setEditId(null);
    setModelId("");
    setKotak([]);
    setIsian({});
    setCatatan("");
    setSimpanGagal(null);
  }

  function muatRiwayat() {
    try {
      setRiwayat(daftarSetoran({ limit: 30 }));
      setMuatRiwayatGagal(null);
    } catch (e) {
      setMuatRiwayatGagal(pesanError(e));
    }
  }

  function bukaDetail(id: number) {
    setDetailTarget(id);
    setDetail(null);
    setDetailGagal(null);
    try {
      const d = detailSetoran(id);
      if (!d) {
        setDetailGagal("Setoran tidak ditemukan.");
        return;
      }
      setDetail(d);
    } catch (e) {
      setDetailGagal(pesanError(e));
    }
  }

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    const items = Object.entries(isian)
      .filter(([, v]) => v !== "" && Number(v) > 0)
      .map(([kunci_, v]) => {
        const [warnaId, ukuran] = kunci_.split("|");
        return {
          modelId: Number(modelId),
          warnaId: Number(warnaId),
          ukuran: ukuran as UkuranLabel,
          jumlah: Number(v) || 0,
        };
      });
    if (items.length === 0) {
      setSimpanGagal("Minimal satu baris warna dan ukuran dengan jumlah lebih dari 0.");
      return;
    }
    setSedangSimpan(true);
    setSimpanGagal(null);

    try {
      await simpanSetoran({
        tanggal,
        catatan: catatan || null,
        items,
        setoranId: mode === "edit" && editId !== null ? editId : undefined,
      });
      resetForm();
      muatRiwayat();
    } catch (e) {
      setSimpanGagal(pesanError(e));
    }
    setSedangSimpan(false);
  }

  async function konfirmasiHapus() {
    if (!hapusTarget) return;
    setSedangHapus(true);
    setHapusGagal(null);
    try {
      await hapusSetoran(hapusTarget.id);
      setHapusTarget(null);
      muatRiwayat();
    } catch (e) {
      setHapusGagal(pesanError(e));
      setHapusTarget(null);
    }
    setSedangHapus(false);
  }

  // ---- ekspor ----
  function siapkanEkspor() {
    const rows: (string | number | null)[][] = [];
    for (const s of riwayat) {
      const itemGaris = s.catatan ? s.catatan : "";
      rows.push([s.tanggal, itemGaris, s.totalPcs]);
    }
    return {
      judul: "Riwayat Setoran",
      subjudul: mode === "edit" ? "Sedang mengubah setoran" : undefined,
      kolom: [
        { label: "Tanggal" },
        { label: "Catatan" },
        { label: "Total Pcs", align: "right" as const },
      ],
      baris: rows,
      catatan: "Setoran hasil jahitan ke atasan",
    };
  }

  const totalForm = Object.values(isian).reduce((s, v) => s + (Number(v) || 0), 0);

  return (
    <>
      {muatRiwayatGagal ? (
        <div className="mb-4">
          <Alert tone="error">{muatRiwayatGagal}</Alert>
        </div>
      ) : null}

      {/* Form setoran */}
      <Card className="mb-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            {mode === "edit" ? `Ubah setoran #${editId}` : "Catat setoran"}
          </h2>
          {mode === "edit" ? (
            <Button size="sm" variant="ghost" onClick={resetForm}>
              Batal ubah
            </Button>
          ) : null}
        </div>

        <form onSubmit={simpan} className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tanggal" htmlFor="tanggal">
              <Input
                id="tanggal"
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                required
              />
            </Field>
            <Field
              label="Model"
              htmlFor="model"
              hint={
                modelId
                  ? "Sisa target di bawah berasal dari hasil potong dikurangi setoran lain."
                  : undefined
              }
            >
              <Select
                id="model"
                value={modelId}
                onChange={(e) => pilihModel(e.target.value)}
                required
              >
                <option value="">Pilih model</option>
                {modelAwal.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nama} ({m.pemilik.nama})
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {muatTargetGagal ? <Alert tone="error">{muatTargetGagal}</Alert> : null}

          {modelId && kotak.length === 0 && !muatTargetGagal ? (
            <p className="text-sm text-teks-lembut">
              Belum ada hasil potongan untuk model ini, jadi belum ada target setoran.
            </p>
          ) : null}

          {kotak.length > 0 ? (
            <div className="flex flex-col gap-3">
              {kotak.map((k) => {
                const namaWarna = warnaAwal.find((w) => w.id === k.warnaId)?.nama ?? k.warnaNama;
                const totalIsianUkuran = k.ukuran.reduce(
                  (s, u) => s + (Number(isian[kunci(k.warnaId, u.label)]) || 0),
                  0,
                );
                const selesai = k.selesai;
                return (
                  <section
                    key={k.warnaId}
                    className={`rounded-lg border p-3 ${
                      selesai ? "border-sukses/40 bg-sukses-lembut" : "border-garis bg-permukaan-2"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">{namaWarna}</h3>
                      <span className="text-xs text-teks-lembut">
                        {selesai ? "sudah lunas" : `sisa ${k.total} pcs`}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-9">
                      {k.ukuran.map((u) => {
                        const sisa = u.kurang;
                        const nilai = isian[kunci(k.warnaId, u.label)] ?? "";
                        return (
                          <label key={u.label} className="flex flex-col gap-1">
                            <span className="text-center text-xs font-medium text-teks-lembut">
                              {u.label}
                            </span>
                            <NumberInput
                              value={nilai}
                              max={sisa > 0 ? sisa : 0}
                              onChange={(e) =>
                                setIsian((x) => ({
                                  ...x,
                                  [kunci(k.warnaId, u.label)]: e.target.value.replace(/[^0-9]/g, ""),
                                }))
                              }
                              disabled={sisa <= 0}
                              placeholder={sisa > 0 ? `0/${sisa}` : "0"}
                              aria-label={`Setoran warna ${namaWarna} ukuran ${u.label}`}
                              className="px-1 py-2"
                            />
                          </label>
                        );
                      })}
                    </div>
                    {totalIsianUkuran > 0 ? (
                      <p className="mt-2 text-xs text-teks-lembut">
                        Diisi: <span className="font-semibold text-teks">{totalIsianUkuran}</span>{" "}
                        pcs untuk {namaWarna}
                      </p>
                    ) : null}
                  </section>
                );
              })}
            </div>
          ) : null}

          <Field label="Catatan (opsional)" htmlFor="catatan">
            <Textarea
              id="catatan"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              rows={2}
              placeholder="Misal: setoran awal minggu"
            />
          </Field>

          {totalForm > 0 ? (
            <p className="text-sm text-teks-lembut">
              Total: <span className="font-semibold text-teks">{totalForm}</span> pcs
            </p>
          ) : null}
          {simpanGagal ? <Alert tone="error">{simpanGagal}</Alert> : null}

          <div>
            <Button type="submit" variant="primary" disabled={sedangSimpan || !modelId || !tanggal}>
              {sedangSimpan
                ? "Menyimpan..."
                : mode === "edit"
                  ? "Simpan perubahan"
                  : "Simpan setoran"}
            </Button>
            <p className="mt-2 text-xs text-teks-lembut">
              Aplikasi menolak kalau setoran melebihi sisa target untuk kombinasi
              model + warna + ukuran mana pun.
            </p>
          </div>
        </form>
      </Card>

      {/* Riwayat setoran */}
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            Riwayat setoran ({riwayat.length})
          </h2>
          <TombolEkspor namaFile={() => namaFileTanggal("riwayat-setoran")} siapkan={siapkanEkspor}>
            Ekspor gambar
          </TombolEkspor>
        </div>

        {riwayat.length === 0 ? (
          <p className="py-8 text-center text-sm text-teks-lembut">
            Belum ada setoran. Catat lewat form di atas.
          </p>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Tanggal</Th>
                  <Th>Catatan</Th>
                  <Th align="right">Total pcs</Th>
                  <Th align="right">Aksi</Th>
                </tr>
              </thead>
              <tbody>
                {riwayat.map((s) => (
                  <tr key={s.id}>
                    <Td className="whitespace-nowrap tabular-nums text-teks-lembut">{s.tanggal}</Td>
                    <Td className="max-w-56 truncate text-teks-lembut">{s.catatan ?? "-"}</Td>
                    <Td align="right" className="font-semibold tabular-nums">
                      {s.totalPcs}
                      <span className="ml-1 text-xs font-normal text-teks-sangat-lembut">
                        ({s.jumlahItem} baris)
                      </span>
                    </Td>
                    <Td align="right">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => bukaDetail(s.id)}>
                          Lihat
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => mulaiUbah(s.id)}>
                          Ubah
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-bahaya hover:bg-bahaya-lembut"
                          onClick={() => {
                            setHapusTarget(s);
                            setHapusGagal(null);
                          }}
                        >
                          Hapus
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      {/* Dialog detail setoran */}
      <ConfirmDialog
        open={detailTarget !== null}
        title={detail ? `Detail setoran ${detail.tanggal}` : "Detail setoran"}
        message={
          <div className="flex flex-col gap-2">
            {detailGagal ? <Alert tone="error">{detailGagal}</Alert> : null}
            {!detailGagal && detail === null ? (
              <p className="text-sm text-teks-lembut">Memuat detail...</p>
            ) : null}
            {detail?.catatan ? <p className="text-sm text-teks-lembut">{detail.catatan}</p> : null}
            {detail ? (
              <div className="-mx-1 overflow-x-auto">
                <table className="w-full min-w-max border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="border-b border-garis-kuat px-2 py-1.5 text-left text-xs font-semibold uppercase text-teks-lembut">
                        Model / Warna
                      </th>
                      <th className="border-b border-garis-kuat px-2 py-1.5 text-center text-xs font-semibold text-teks-lembut">
                        Ukuran
                      </th>
                      <th className="border-b border-garis-kuat px-2 py-1.5 text-right text-xs font-semibold text-teks-lembut">
                        Jumlah
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((it, i) => (
                      <tr key={i}>
                        <td className="border-b border-garis px-2 py-1.5 whitespace-nowrap">
                          <span className="text-teks-lembut">{it.pemilikNama}</span> /{" "}
                          {it.modelNama} / {it.warnaNama}
                        </td>
                        <td className="border-b border-garis px-2 py-1.5 text-center tabular-nums">
                          {it.ukuran}
                        </td>
                        <td className="border-b border-garis px-2 py-1.5 text-right tabular-nums">
                          {it.jumlah}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td className="px-2 py-1.5 text-right font-semibold" colSpan={2}>
                        Total
                      </td>
                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                        {detail.totalPcs} pcs
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        }
        confirmLabel="Tutup"
        busy={false}
        onConfirm={() => setDetailTarget(null)}
        onCancel={() => setDetailTarget(null)}
      />

      {/* Dialog hapus setoran */}
      <ConfirmDialog
        open={hapusTarget !== null}
        title="Hapus setoran?"
        message={
          <div className="flex flex-col gap-3">
            {hapusGagal ? <Alert tone="error">{hapusGagal}</Alert> : null}
            <p className="text-sm">
              Setoran {hapusTarget?.tanggal} ({hapusTarget?.totalPcs} pcs) akan dihapus
              beserta semua itemnya. Kuota setoran untuk kombinasi itu langsung terbebas.
            </p>
          </div>
        }
        confirmLabel="Hapus"
        busy={sedangHapus}
        onConfirm={konfirmasiHapus}
        onCancel={() => !sedangHapus && setHapusTarget(null)}
      />
    </>
  );
}