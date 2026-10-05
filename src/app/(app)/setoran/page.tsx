import { PageHeader } from "@/components/ui/Alert";
import TransaksiForm from "@/components/forms/TransaksiForm";
import { hariIniWIB } from "@/lib/tanggal";

export const metadata = { title: "Setoran" };
export const dynamic = "force-dynamic";

export default function SetoranPage() {
  return (
    <>
      <PageHeader
        title="Catat Setoran"
        description="Hasil jahitan yang disetor balik dari penjahit."
      />
      <TransaksiForm jenis="SETORAN" tanggalAwal={hariIniWIB()} />
    </>
  );
}