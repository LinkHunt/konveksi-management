import { PageHeader } from "@/components/ui/Alert";
import TransaksiForm from "@/components/forms/TransaksiForm";
import { hariIniWIB } from "@/lib/tanggal";

export const metadata = { title: "Bahan Keluar" };
export const dynamic = "force-dynamic";

export default function BahanKeluarPage() {
  return (
    <>
      <PageHeader
        title="Catat Bahan Keluar"
        description="Bahan yang dibawa ke penjahit. Ini yang jadi acuan hitungan sisa."
      />
      <TransaksiForm jenis="BAHAN_KELUAR" tanggalAwal={hariIniWIB()} />
    </>
  );
}