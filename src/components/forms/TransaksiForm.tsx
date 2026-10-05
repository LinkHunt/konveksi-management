"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Alert, Card } from "@/components/ui/Alert";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { buat, hapus, ubah, ambilMaster, type BarisBasic, type BarisModel } from "@/lib/client-api";
import UkuranTable, { kosongkan, totalPcs, type BarisUkuran } from "./UkuranTable";

export type JenisTransaksi = "SETORAN" | "BAHAN_KELUAR";

export type TransaksiUntukEdit = {
  id: number;
  tanggal: string;
  jenis: JenisTransaksi;
  penjahit: { id: number; nama: string };
  model: { id: number; nama: string };
  warna: { id: number; nama: string };
  catatan: string | null;
  items: { ukuran: string; jumlah: number }[];
};

type Master = {
  penjahit: BarisBasic[];
  model: BarisModel[];
  warna: BarisBasic[];
};

export default function TransaksiForm({
  jenis,
  tanggalAwal,
  edit,
}: {
  jenis: JenisTransaksi;
  /**
   * Tanggal default dihitung di server component dan dikirim lewat payload RSC.
   * Kalau dihitung sendiri di client, tanggal bisa berbeda antara render server
   * dan hydrasi, dan React akan protes soal hydration.
   */
  tanggalAwal: string;
  /** Kalau diisi, form dipakai untuk mengoreksi transaksi yang sudah ada. */
  edit?: TransaksiUntukEdit;
}) {
  const router = useRouter();
  const mode = edit ? "ubah" : "tambah";
  const judul = jenis === "SETORAN" ? "Setoran" : "Bahan Keluar";
  // Dipakai sebagai dependency effect. `edit` sendiri object, jadi andalkan
  // identity-nya bisa memicu fetch ulang kalau parent render ulang.
  const sedangUbah = edit !== undefined;

  const [master, setMaster] = useState<Master | null>(null);
  const [muatGagal, setMuatGagal] = useState<string | null>(null);
  const [simpan, setSimpan] = useState<{ gala: boolean; pesan: string | null }>({
    gala: false,
    pesan: null,
  });
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(false);
  const [hapusGagal, setHapusGagal] = useState<string | null>(null);

  const [tanggal, setTanggal] = useState(edit?.tanggal ?? tanggalAwal);
  const [penjahitId, setPenjahitId] = useState(String(edit?.penjahit.id ?? ""));
  const [modelId, setModelId] = useState(String(edit?.model.id ?? ""));
  const [warnaId, setWarnaId] = useState(String(edit?.warna.id ?? ""));
  const [catatan, setCatatan] = useState(edit?.catatan ?? "");
  const [baris, setBaris] = useState<BarisUkuran[]>(() => {
    if (!edit) return kosongkan();
    // Isi hanya ukuran yang ada di transaksi, sisanya tetap kosong.
    const peta = new Map(edit.items.map((i) => [i.ukuran, i.jumlah]));
    return kosongkan().map((b) => ({
      ukuran: b.ukuran,
      jumlah: peta.has(b.ukuran) ? String(peta.get(b.ukuran)) : "",
    }));
  });

  useEffect(() => {
    let batal = false;
    (async () => {
      // Saat koreksi, master nonaktif tetap harus muncul supaya transaksi
      // lama yang memakainya masih bisa disimpan. Saat tambah baru, master
      // nonaktif tidak boleh dipilih (server juga menolak), jadi disembunyikan.
      const semua = sedangUbah;
      const [pj, md, wr] = await Promise.all([
        ambilMaster<BarisBasic>("penjahit", { semua }),
        ambilMaster<BarisModel>("model", { semua }),
        ambilMaster<BarisBasic>("warna", { semua }),
      ]);
      if (batal) return;
      const gagal = [pj, md, wr].find((r) => !r.ok);
      if (gagal && !gagal.ok) {
        setMuatGagal(gagal.error.message);
        return;
      }
      setMaster({
        penjahit: pj.ok ? pj.data : [],
        model: md.ok ? md.data : [],
        warna: wr.ok ? wr.data : [],
      });
    })();
    return () => {
      batal = true;
    };
  }, [sedangUbah]);

  const total = totalPcs(baris);
  const bolehSimpan =
    Boolean(tanggal) &&
    penjahitId !== "" &&
    modelId !== "" &&
    warnaId !== "" &&
    total > 0 &&
    !simpan.gala;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!bolehSimpan) return;
    setSimpan({ gala: true, pesan: null });

    const payload = {
      tanggal,
      jenis: edit ? edit.jenis : jenis,
      penjahitId: Number(penjahitId),
      modelId: Number(modelId),
      warnaId: Number(warnaId),
      catatan: catatan.trim() || null,
      // Server membuang jumlah 0 diam-diam, jadi cukup kirim yang isinya angka.
      items: baris
        .filter((b) => Number.parseInt(b.jumlah, 10) > 0)
        .map((b) => ({ ukuran: b.ukuran, jumlah: Number.parseInt(b.jumlah, 10) })),
    };

    const hasil =
      edit === undefined
        ? await buat("/api/transaksi", payload)
        : await ubah(`/api/transaksi/${edit.id}`, "PUT", payload);

    if (!hasil.ok) {
      setSimpan({ gala: false, pesan: hasil.error.message });
      return;
    }
    router.replace("/");
    router.refresh();
  }

  async function hapusTransaksi() {
    if (!edit) return;
    setHapusGagal(null);
    const hasil = await hapus(`/api/transaksi/${edit.id}`);
    if (!hasil.ok) {
      setKonfirmasiHapus(false);
      setHapusGagal(hasil.error.message);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  if (muatGagal) return <Alert tone="error">{muatGagal}</Alert>;
  if (!master) {
    return <p className="py-10 text-center text-sm text-teks-lembut">Memuat data...</p>;
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tanggal" htmlFor="tanggal">
            <Input
              id="tanggal"
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              required
            />
          </Field>

          <Field label="Penjahit" htmlFor="penjahit">
            <Select
              id="penjahit"
              value={penjahitId}
              onChange={(e) => setPenjahitId(e.target.value)}
              required
            >
              <option value="">Pilih penjahit</option>
              {master.penjahit.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama}
                  {p.aktif ? "" : " (nonaktif)"}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Model baju" htmlFor="model">
            <Select
              id="model"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              required
            >
              <option value="">Pilih model</option>
              {master.model.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.pemilik.nama} - {m.nama}
                  {m.aktif ? "" : " (nonaktif)"}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Warna" htmlFor="warna">
            <Select id="warna" value={warnaId} onChange={(e) => setWarnaId(e.target.value)} required>
              <option value="">Pilih warna</option>
              {master.warna.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.nama}
                  {w.aktif ? "" : " (nonaktif)"}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Catatan" htmlFor="catatan" hint={`${catatan.length}/500, opsional`}>
          <Textarea
            id="catatan"
            rows={2}
            maxLength={500}
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Contoh: jahitan sudah dikunci"
          />
        </Field>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Jumlah per ukuran</h2>
          <span className="text-sm text-teks-lembut">
            Total <span className="font-semibold tabular-nums text-teks">{total}</span> pcs
          </span>
        </div>
        <UkuranTable baris={baris} onChange={setBaris} />
      </Card>

      {simpan.pesan ? <Alert tone="error">{simpan.pesan}</Alert> : null}
      {hapusGagal ? <Alert tone="error">{hapusGagal}</Alert> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="primary" disabled={!bolehSimpan}>
          {simpan.gala ? "Menyimpan..." : mode === "ubah" ? "Simpan perubahan" : `Simpan ${judul}`}
        </Button>
        <Button variant="ghost" onClick={() => router.back()} disabled={simpan.gala}>
          Batal
        </Button>
        {edit ? (
          <Button
            variant="danger"
            className="ml-auto"
            onClick={() => setKonfirmasiHapus(true)}
            disabled={simpan.gala}
          >
            Hapus
          </Button>
        ) : null}
      </div>

      <ConfirmDialog
        open={konfirmasiHapus}
        title={`Hapus transaksi ${judul.toLowerCase()} ini?`}
        message="Transaksi akan dihapus permanen beserta semua jumlah per ukurannya. Angka sisa yang belum disetor ikut berubah."
        confirmLabel="Hapus permanen"
        busy={simpan.gala}
        onConfirm={hapusTransaksi}
        onCancel={() => setKonfirmasiHapus(false)}
      />
    </form>
  );
}