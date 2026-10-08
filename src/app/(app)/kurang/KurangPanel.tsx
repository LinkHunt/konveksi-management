"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/Alert";
import { Table, Td, Th, TableWrap } from "@/components/ui/Table";
import TombolEkspor from "@/components/ui/TombolEkspor";
import { namaFileModel } from "@/lib/ekspor-tabel";
import type { KotakKurang } from "@/lib/kurang";

/*
 * Panel "Belum di setorkan": daftar kotak kurang (per model + warna) yang
 * dikelompokkan per model. Tiap grup punya tombol "Foto" yang mengekspor
 * SEMUA warna model itu jadi satu gambar (1 model = 1 foto). Data datang dari
 * server component sebagai snapshot, di sini murni presentasi + ekspor.
 *
 * Kolom ukuran mengambil ukuran dari kotak pertama yang muncul (semua model
 * memakai daftar ukuran yang sama).
 */
export default function KurangPanel({ awal }: { awal: KotakKurang[] }) {
  const totalKurang = awal.reduce((s, k) => s + k.total, 0);

  // Grup per model: { modelId, modelNama, pemilikNama, kotak[] }
  const perModel = useMemo(() => {
    const peta = new Map<
      number,
      { modelId: number; modelNama: string; pemilikNama: string; kotak: KotakKurang[] }
    >();
    for (const k of awal) {
      let g = peta.get(k.modelId);
      if (!g) {
        g = { modelId: k.modelId, modelNama: k.modelNama, pemilikNama: k.pemilikNama, kotak: [] };
        peta.set(k.modelId, g);
      }
      g.kotak.push(k);
    }
    return [...peta.values()].sort((a, b) => a.modelNama.localeCompare(b.modelNama, "id"));
  }, [awal]);

  // Kolom gambar per model: Warna + ukuran + Total. Ukuran dari kotak pertama.
  function siapkanModel(g: (typeof perModel)[number]) {
    const kolom = [
      ...(g.pemilikNama ? [{ label: "Model", lebarMin: 110 }] : []),
      ...(g.kotak[0]?.ukuran.map((u) => ({ label: u.label, align: "center" as const, lebarMin: 36 })) ??
        []),
      { label: "Total", align: "right" as const, lebarMin: 56 },
    ];
    const baris = g.kotak.map((k) => [
      ...(g.pemilikNama ? [k.modelNama] : []),
      k.warnaNama,
      ...k.ukuran.map((u) => u.kurang),
      k.total,
    ]);
    return {
      judul: `Bahan yang belum di setorkan · ${g.modelNama}`,
      subjudul: g.pemilikNama,
      kolom,
      baris,
      catatan: "Angka = sisa yang belum disetor per ukuran",
    };
  }

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          Belum di setorkan ({awal.length} kombinasi
          {awal.length > 0 ? `, ${totalKurang} pcs` : ""})
        </h2>
      </div>

      {awal.length === 0 ? (
        <p className="py-8 text-center text-sm text-teks-lembut">
          Belum ada hasil potongan, atau semua kombinasi sudah disetor penuh dan disaring
          oleh filter sembunyikan selesai.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {perModel.map((g) => (
            <section key={g.modelId} className="rounded-lg border border-garis bg-permukaan-2 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{g.modelNama}</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm text-teks-lembut">{g.pemilikNama}</p>
                  <TombolEkspor
                    siapkan={() => siapkanModel(g)}
                    namaFile={namaFileModel("belum-di-setorkan", g.modelNama)}
                  >
                    Foto model
                  </TombolEkspor>
                </div>
              </div>
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Warna</Th>
                      {g.kotak[0]?.ukuran.map((u) => (
                        <Th key={`${g.modelId}-${u.label}`} align="center">
                          {u.label}
                        </Th>
                      ))}
                      <Th align="right">Total</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.kotak.map((k) => (
                      <tr key={`${g.modelId}-${k.warnaId}`}>
                        <Td className="whitespace-nowrap">{k.warnaNama}</Td>
                        {k.ukuran.map((u) => (
                          <Td
                            key={`${g.modelId}-${k.warnaId}-${u.label}`}
                            align="center"
                            className={`tabular-nums ${
                              u.kurang > 0 ? "font-medium text-teks" : "text-teks-sangat-lembut"
                            }`}
                          >
                            {u.kurang}
                          </Td>
                        ))}
                        <Td
                          align="right"
                          className={`font-semibold tabular-nums ${
                            k.selesai ? "text-teks-lembut" : "text-aksen"
                          }`}
                        >
                          {k.selesai ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-sukses-lembut px-2 py-0.5 text-xs font-medium text-sukses">
                              <svg
                                viewBox="0 0 24 24"
                                className="h-3 w-3"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2.5}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden
                              >
                                <path d="M20 6 9 17l-5-5" />
                              </svg>
                              Lunas
                            </span>
                          ) : (
                            k.total
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}