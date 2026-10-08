"use client";

import { useMemo } from "react";
import { daftar } from "@/lib/master";
import { PageHeader } from "@/components/ui/Alert";
import MasterTable from "@/components/forms/MasterTable";

/*
 * Master model baju. Data dibaca langsung dari database lokal saat render.
 */
export default function ModelPage() {
  const { model, opsiPemilik } = useMemo(() => {
    const model = daftar("model", {});
    const pemilik = daftar("pemilik", {});
    return {
      model,
      opsiPemilik: pemilik.map((p) => ({ id: p.id, nama: p.nama })),
    };
  }, []);

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