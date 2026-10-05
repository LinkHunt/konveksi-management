import { getDb } from "@/lib/db";
import { daftar } from "@/lib/master";
import { PageHeader } from "@/components/ui/Alert";
import MasterTable from "@/components/forms/MasterTable";

export const metadata = { title: "Pemilik" };
export const dynamic = "force-dynamic";

export default async function PemilikPage() {
  // Daftar diambil di server supaya halaman tidak flicker kosong lalu isi.
  const awal = await daftar(getDb(), "pemilik", {});
  return (
    <>
      <PageHeader
        title="Pemilik"
        description="Pemilik baju. Model baju selalu punya satu pemilik."
      />
      <MasterTable entity="pemilik" butuhPemilik={false} awal={awal} />
    </>
  );
}