import { getDb } from "@/lib/db";
import { daftar } from "@/lib/master";
import { PageHeader } from "@/components/ui/Alert";
import MasterTable from "@/components/forms/MasterTable";

export const metadata = { title: "Penjahit" };
export const dynamic = "force-dynamic";

export default async function PenjahitPage() {
  const awal = await daftar(getDb(), "penjahit", {});
  return (
    <>
      <PageHeader title="Penjahit" description="Orang yang menjahit. Sisa dihitung per penjahit." />
      <MasterTable entity="penjahit" butuhPemilik={false} awal={awal} />
    </>
  );
}