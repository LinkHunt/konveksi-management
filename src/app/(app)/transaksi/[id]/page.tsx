import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { SELECT_TRANSAKSI, serialisasiTransaksi } from "@/lib/transaksi";
import { PageHeader, Alert } from "@/components/ui/Alert";
import TransaksiForm, { type TransaksiUntukEdit } from "@/components/forms/TransaksiForm";

export const dynamic = "force-dynamic";

export default async function EditTransaksiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const angka = Number(id);
  if (!Number.isInteger(angka) || angka <= 0) notFound();

  const db = getDb();
  const row = await db.transaksi.findUnique({ where: { id: angka }, select: SELECT_TRANSAKSI });
  if (!row) notFound();

  const t = serialisasiTransaksi(row);
  const edit: TransaksiUntukEdit = {
    id: t.id,
    tanggal: t.tanggal,
    jenis: t.jenis,
    penjahit: t.penjahit,
    model: t.model,
    catatan: t.catatan,
    items: t.items,
  };
  const judul = t.jenis === "SETORAN" ? "Setoran" : "Bahan Keluar";

  return (
    <>
      <PageHeader title={`Koreksi ${judul}`} description={`Transaksi tanggal ${t.tanggal}.`} />
      <div className="mb-4">
        <Alert tone="info">
          Menyimpan akan mengganti seluruh isi transaksi ini, termasuk semua jumlah per
          ukurannya. Baris ukuran yang dikosongkan akan hilang.
        </Alert>
      </div>
      <TransaksiForm jenis={t.jenis} tanggalAwal={t.tanggal} edit={edit} />
    </>
  );
}