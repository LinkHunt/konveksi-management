import Link from "next/link";
import { getDb } from "@/lib/db";
import { hitungSisa } from "@/lib/sisa";
import { serialisasiTransaksi, SELECT_TRANSAKSI } from "@/lib/transaksi";
import { Alert, Card, PageHeader } from "@/components/ui/Alert";
import { Table, Td, Th, TableWrap } from "@/components/ui/Table";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  /*
   * Halaman ini server component, jadi boleh baca database langsung lewat
   * src/lib. Tidak perlu fetch ke /api/transaksi miliknya sendiri: itu boros
   * dan menambah satu lapis JSON yang tidak berguna.
   */
  const db = getDb();
  const [terbaru, sisa] = await Promise.all([
    db.transaksi.findMany({
      select: SELECT_TRANSAKSI,
      orderBy: [{ tanggal: "desc" }, { id: "desc" }],
      take: 8,
    }),
    hitungSisa(db, {}),
  ]);

  const rows = terbaru.map(serialisasiTransaksi);
  const totalSisa = sisa.reduce((s, b) => s + b.sisa, 0);
  const adaLebih = sisa.some((b) => b.lebih);

  return (
    <>
      <PageHeader
        title="Beranda"
        description="Ringkasan cepat. Pilih menu di samping untuk mencatat atau melihat data."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-teks-lembut">Totalpcs belum disetor</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{totalSisa}</p>
          <Link href="/sisa" className="mt-1 inline-block text-sm text-aksen hover:underline">
            Lihat rincian
          </Link>
        </Card>
        <Card>
          <p className="text-sm text-teks-lembut">Transaksi terakhir</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{terbaru.length}</p>
          <p className="mt-1 text-sm text-teks-lembut">8 transaksi terbaru</p>
        </Card>
      </div>

      {adaLebih ? (
        <div className="mb-5">
          <Alert tone="warning">
            Ada sisa negatif: lebih banyak setoran daripada bahan keluar untuk kombinasi
            penjahit, model, warna, dan ukuran. Cek dulu kalau ini bukan salah input.
          </Alert>
        </div>
      ) : null}

      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Transaksi terbaru</h2>
          <div className="flex gap-2">
            <Link
              href="/setoran"
              className="rounded-lg bg-aksen px-3 py-1.5 text-sm font-medium text-white hover:bg-aksen-gelap"
            >
              Setoran
            </Link>
            <Link
              href="/bahan-keluar"
              className="rounded-lg border border-garis-kuat px-3 py-1.5 text-sm font-medium hover:bg-permukaan-2"
            >
              Bahan keluar
            </Link>
          </div>
        </div>

        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Tanggal</Th>
                <Th>Jenis</Th>
                <Th>Penjahit</Th>
                <Th>Model</Th>
                <Th>Warna</Th>
                <Th align="right">Pcs</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <Td colSpan={6} align="center" className="py-10 text-teks-lembut">
                    Belum ada transaksi. Mulai dari menu Setoran.
                  </Td>
                </tr>
              ) : (
                rows.map((t) => (
                  <tr key={t.id}>
                    <Td className="whitespace-nowrap tabular-nums text-teks-lembut">{t.tanggal}</Td>
                    <Td>
                      <Badge jenis={t.jenis} />
                    </Td>
                    <Td className="whitespace-nowrap">{t.penjahit.nama}</Td>
                    <Td className="whitespace-nowrap">
                      <span className="text-teks-lembut">{t.pemilik.nama}</span> / {t.model.nama}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {t.items
                        .map((i) => i.warna.nama)
                        .filter((nama, i, semua) => semua.indexOf(nama) === i)
                        .join(", ")}
                    </Td>
                    <Td align="right" className="tabular-nums font-medium">
                      <Link href={`/transaksi/${t.id}`} className="hover:text-aksen hover:underline">
                        {t.totalPcs}
                      </Link>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </TableWrap>

        {rows.length > 0 ? (
          <p className="mt-3 text-xs text-teks-lembut">
            Klik angka pcs untuk membuka dan mengoreksi transaksi.
          </p>
        ) : null}
      </Card>
    </>
  );
}

export function Badge({ jenis }: { jenis: "SETORAN" | "BAHAN_KELUAR" }) {
  const setoran = jenis === "SETORAN";
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
        setoran ? "bg-sukses-lembut text-sukses" : "bg-aksen-lembut text-aksen-gelap"
      }`}
    >
      {setoran ? "Setoran" : "Bahan keluar"}
    </span>
  );
}