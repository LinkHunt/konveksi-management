import Link from "next/link";
import { getDb } from "@/lib/db";
import { kelompokkanPerPenjahit, hitungSisa } from "@/lib/sisa";
import { UKURAN_LIST } from "@/lib/ukuran";
import { daftar } from "@/lib/master";
import { Alert, Card, PageHeader } from "@/components/ui/Alert";
import SisaFilters, { type FilterSisa } from "./SisaFilters";

export const metadata = { title: "Sisa" };
export const dynamic = "force-dynamic";

export default async function SisaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const angka = (k: string): number | undefined => {
    const v = sp[k];
    const n = typeof v === "string" ? Number(v) : NaN;
    return Number.isInteger(n) && n > 0 ? n : undefined;
  };
  const sembunyiNol = sp.sembunyikanNol !== "0";
  const filter: FilterSisa = {
    penjahitId: angka("penjahitId"),
    pemilikId: angka("pemilikId"),
    modelId: angka("modelId"),
    warnaId: angka("warnaId"),
  };

  const db = getDb();
  /*
   * Filter dan agregasi butuh master yang sama. Semua master diambil dengan
   * `semua: true` supaya transaksi lama yang memakai master nonaktif tetap
   * punya filter yang bisa dipilih, kalau tidak barisnya jadi tidak bisa
   * difilter sama sekali.
   *
   * `daftar` mengembalikan union karena entity model punya field ekstra. Yang
   * dibutuhkan di sini cuma id + nama, jadi diserialkan lewat `idNama`.
   */
  const [baris, pjRows, pkRows, mdRows, wrRows] = await Promise.all([
    hitungSisa(db, filter),
    daftar(db, "penjahit", {}),
    daftar(db, "pemilik", {}),
    daftar(db, "model", {}),
    daftar(db, "warna", {}),
  ]);
  const idNama = (rows: unknown[]) =>
    (rows as { id: number; nama: string }[]).map((r) => ({ id: r.id, nama: r.nama }));
  const penjahit = idNama(pjRows);
  const pemilik = idNama(pkRows);
  const model = idNama(mdRows);
  const warna = idNama(wrRows);

  const terlihat = sembunyiNol ? baris.filter((b) => b.sisa !== 0) : baris;
  const perPenjahit = kelompokkanPerPenjahit(terlihat);
  const totalSisa = perPenjahit.reduce((s, g) => s + g.totalSisa, 0);
  const totalBahan = perPenjahit.reduce((s, g) => s + g.totalBahanKeluar, 0);
  const totalSetor = perPenjahit.reduce((s, g) => s + g.totalSetoran, 0);

  return (
    <>
      <PageHeader
        title="Sisa Belum Disetor"
        description="Bahan keluar dikurangi setoran, per penjahit, pemilik, model, warna, dan ukuran."
      />

      <SisaFilters
        penjahit={penjahit}
        pemilik={pemilik}
        model={model}
        warna={warna}
        awal={filter}
        sembunyiNol={sembunyiNol}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Ringkas label="Bahan keluar" nilai={totalBahan} />
        <Ringkas label="Setoran" nilai={totalSetor} />
        <Ringkas label="Sisa" nilai={totalSisa} nada={totalSisa < 0 ? "bahaya" : "aksen"} />
      </div>

      {perPenjahit.some((g) => g.adaLebih) ? (
        <div className="mb-5">
          <Alert tone="warning">
            Ada sisa negatif. Itu berarti lebih banyak setoran daripada bahan keluar untuk
            kombinasi tersebut, kemungkinan salah input. Buka transaksi pembandingnya lewat
            menu Beranda.
          </Alert>
        </div>
      ) : null}

      {perPenjahit.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-teks-lembut">
            {baris.length === 0
              ? "Belum ada transaksi sama sekali, jadi sisa belum bisa dihitung."
              : "Semua sisa sudah nol. Centang \"tampilkan sisa 0\" di atas kalau mau melihat detailnya."}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {perPenjahit.map((g) => (
            <Card key={g.penjahit.id}>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold">{g.penjahit.nama}</h2>
                <p className="text-sm text-teks-lembut">
                  sisa{" "}
                  <span className={g.totalSisa < 0 ? "font-semibold text-bahaya" : "font-semibold text-teks"}>
                    {g.totalSisa}
                  </span>{" "}
                  dari {g.totalBahanKeluar} pcs bahan keluar
                </p>
              </div>

              <div className="-mx-4 overflow-x-auto px-4">
                <table className="w-full min-w-max border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="border-b border-garis-kuat px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-teks-lembut">
                        Pemilik / Model / Warna
                      </th>
                      {UKURAN_LIST.map((u) => (
                        <th
                          key={u}
                          className="border-b border-garis-kuat px-2 py-2 text-center text-xs font-semibold text-teks-lembut"
                        >
                          {u}
                        </th>
                      ))}
                      <th className="border-b border-garis-kuat px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-teks-lembut">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.baris.map((b, i) => {
                      // Kelompokkan baris yang cuma punya satu ukuran. Sisa biasanya
                      // dipecah per ukuran, tapi kalau satu kombinasi cuma punya
                      // satu ukuran, barisnya lebih enak dibaca kalau digabung.
                      const totalBaris = b.bahanKeluar + b.setoran;
                      return (
                        <tr key={`${b.modelId}-${b.warnaId}-${b.ukuran}-${i}`}>
                          <td className="border-b border-garis px-2 py-2 whitespace-nowrap">
                            <span className="text-teks-lembut">{b.pemilikNama}</span> /{" "}
                            {b.modelNama} / {b.warnaNama}
                          </td>
                          {UKURAN_LIST.map((u) => {
                            const sisaUkuran = u === b.ukuran ? b.sisa : null;
                            return (
                              <td
                                key={u}
                                className={`border-b border-garis px-2 py-2 text-center tabular-nums ${
                                  sisaUkuran === null
                                    ? "text-teks-sangat-lembut"
                                    : sisaUkuran < 0
                                      ? "font-semibold text-bahaya"
                                      : sisaUkuran > 0
                                        ? "font-medium text-teks"
                                        : "text-teks-sangat-lembut"
                                }`}
                              >
                                {sisaUkuran === null ? "-" : sisaUkuran}
                              </td>
                            );
                          })}
                          <td className="border-b border-garis px-2 py-2 text-right tabular-nums text-teks-lembut">
                            {totalBaris}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="mt-5 text-xs text-teks-lembut">
        Angka di kolom ukuran adalah sisa per ukuran. Kolom total menunjukkan jumlah bahan
        keluar untuk kombinasi itu.{" "}
        <Link href="/bahan-keluar" className="text-aksen hover:underline">
          Catat bahan keluar
        </Link>{" "}
        atau{" "}
        <Link href="/setoran" className="text-aksen hover:underline">
          catat setoran
        </Link>
        .
      </p>
    </>
  );
}

function Ringkas({
  label,
  nilai,
  nada,
}: {
  label: string;
  nilai: number;
  nada?: "aksen" | "bahaya";
}) {
  return (
    <Card>
      <p className="text-sm text-teks-lembut">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          nada === "bahaya" ? "text-bahaya" : nada === "aksen" ? "text-aksen" : ""
        }`}
      >
        {nilai}
      </p>
    </Card>
  );
}