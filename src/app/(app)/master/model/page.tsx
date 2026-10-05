import { getDb } from "@/lib/db";
import { daftar } from "@/lib/master";
import { PageHeader } from "@/components/ui/Alert";
import MasterTable from "@/components/forms/MasterTable";

export const metadata = { title: "Model Baju" };
export const dynamic = "force-dynamic";

export default async function ModelPage() {
  // Model dan daftar pemilik diambil bareng, keduanya di server.
  const db = getDb();
  const [model, pemilik] = await Promise.all([
    daftar(db, "model", {}),
    daftar(db, "pemilik", {}),
  ]);
  const opsiPemilik = pemilik.map((p) => ({ id: p.id, nama: p.nama }));

  return (
    <>
      <PageHeader
        title="Model Baju"
        description="Model dikaitkan ke pemilik. Dua pemilik boleh punya model dengan nama sama."
      />
      <MasterTable entity="model" butuhPemilik withPemilik={opsiPemilik} awal={model} />
    </>
  );
}