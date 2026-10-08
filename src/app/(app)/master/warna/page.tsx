"use client";

import { useMemo } from "react";
import { daftar } from "@/lib/master";
import { PageHeader } from "@/components/ui/Alert";
import MasterTable from "@/components/forms/MasterTable";

/*
 * Master warna. Data dibaca langsung dari database lokal saat render.
 */
export default function WarnaPage() {
  const awal = useMemo(() => daftar("warna", {}), []);
  return (
    <>
      <PageHeader title="Warna" description="Pilihan warna kain." />
      <MasterTable entity="warna" butuhPemilik={false} awal={awal} />
    </>
  );
}