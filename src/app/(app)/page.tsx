"use client";

import { Link } from "react-router-dom";
import { getDb } from "@/lib/db";
import { hitungKurang, kotakKurang } from "@/lib/kurang";
import { daftarSetoran } from "@/lib/setoran";
import { Alert, Card, PageHeader } from "@/components/ui/Alert";
import { Table, Td, Th, TableWrap } from "@/components/ui/Table";
import { useMemo } from "react";

/*
 * Beranda (dashboard): ringkasan cepat. Data dibaca langsung dari database
 * lokal (sql.js) — app offline, tidak ada API/server. Karena semua data lokal
 * dan dibaca sinkron, render ulang tidak perlu fetch: komponen ini murni
 * menampilkan snapshot db saat render.
 */
export default function DashboardPage() {
  const { setoran, totalKurangStr, terbesar, adaLebih } = useMemo(() => {
    const db = getDb();
    const baris = hitungKurang({});
    const setoran = daftarSetoran(db, { limit: 8 });
    const kotak = kotakKurang(baris).filter((k) => !k.selesai);
    const totalKurang = kotak.reduce((s, k) => s + k.total, 0);
    const terbesar = [...kotak].sort((a, b) => b.total - a.total).slice(0, 8);
    const adaLebih = baris.some((b) => b.lebih);
    return { setoran, totalKurangStr: String(totalKurang), terbesar, adaLebih };
  }, []);

  return (
    <>
      <PageHeader
        title="Beranda"
        description="Ringkasan cepat. Pilih menu di atas untuk mencatat atau melihat data."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-teks-lembut">Total kurang belum disetor</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{totalKurangStr}</p>
          <Link to="/kurang" className="mt-1 inline-block text-sm text-aksen hover:underline">
            Lihat rincian
          </Link>
        </Card>
        <Card>
          <p className="text-sm text-teks-lembut">Setoran terbaru</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{setoran.length}</p>
          <p className="mt-1 text-sm text-teks-lembut">Setoran terakhir tercatat</p>
        </Card>
      </div>

      {adaLebih ? (
        <div className="mb-5">
          <Alert tone="warning">
            Ada lebih banyak yang disetor daripada hasil potongan untuk satu kombinasi.
            Ini tidak normal — cek hasil potongan dan setoran yang bersangkutan.
          </Alert>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Belum di setorkan terbesar</h2>
            {terbesar.length > 0 ? (
              <Link to="/kurang" className="text-sm text-aksen hover:underline">
                Semua
              </Link>
            ) : null}
          </div>
          {terbesar.length === 0 ? (
            <p className="py-6 text-center text-sm text-teks-lembut">
              Tidak ada kurang: semua hasil potongan sudah disetor, atau belum ada
              hasil potongan.
            </p>
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Pemilik</Th>
                    <Th>Model</Th>
                    <Th>Warna</Th>
                    <Th align="right">Belum disetor</Th>
                  </tr>
                </thead>
                <tbody>
                  {terbesar.map((k) => (
                    <tr key={`${k.modelId}-${k.warnaId}`}>
                      <Td className="whitespace-nowrap text-teks-lembut">{k.pemilikNama}</Td>
                      <Td className="whitespace-nowrap font-medium">{k.modelNama}</Td>
                      <Td className="whitespace-nowrap">{k.warnaNama}</Td>
                      <Td align="right" className="font-semibold tabular-nums">
                        {k.total}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Setoran terbaru</h2>
            {setoran.length > 0 ? (
              <Link to="/setoran" className="text-sm text-aksen hover:underline">
                Semua
              </Link>
            ) : null}
          </div>
          {setoran.length === 0 ? (
            <p className="py-6 text-center text-sm text-teks-lembut">
              Belum ada setoran. Mulai dari menu Setoran.
            </p>
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Tanggal</Th>
                    <Th>Catatan</Th>
                    <Th align="right">Total pcs</Th>
                  </tr>
                </thead>
                <tbody>
                  {setoran.map((s) => (
                    <tr key={s.id}>
                      <Td className="whitespace-nowrap tabular-nums text-teks-lembut">
                        {s.tanggal}
                      </Td>
                      <Td className="max-w-56 truncate text-teks-lembut">{s.catatan ?? "-"}</Td>
                      <Td align="right" className="font-semibold tabular-nums">
                        {s.totalPcs}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
      </div>
    </>
  );
}