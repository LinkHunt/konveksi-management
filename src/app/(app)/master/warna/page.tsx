import { getDb } from "@/lib/db";
import { daftar } from "@/lib/master";
import { PageHeader } from "@/components/ui/Alert";
import MasterTable from "@/components/forms/MasterTable";

export const metadata = { title: "Warna" };
export const dynamic = "force-dynamic";

export default async function WarnaPage() {
  const awal = await daftar(getDb(), "warna", {});
  return (
    <>
      <PageHeader title="Warna" description="Pilihan warna kain." />
      <MasterTable entity="warna" butuhPemilik={false} awal={awal} />
    </>
  );
}