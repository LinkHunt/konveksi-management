"use client";

import { useMemo } from "react";
import { daftar } from "@/lib/master";
import { PageHeader } from "@/components/ui/Alert";
import MasterTable from "@/components/forms/MasterTable";

/*
 * Master pemilik. Data dibaca langsung dari database lokal saat render
 * (aplikasi offline), lalu MasterTable menangani tambah/ubah/nonaktifkan.
 */
export default function PemilikPage() {
  const awal = useMemo(() => daftar("pemilik", {}), []);
  return (
    <>
      <PageHeader title="Pemilik" description="Pemilik baju. Model baju selalu punya satu pemilik." />
      <MasterTable entity="pemilik" butuhPemilik={false} awal={awal} />
    </>
  );
}