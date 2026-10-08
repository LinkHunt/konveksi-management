// Ekspor tabel jadi gambar PNG, digambar lewat canvas biasa.
//
// Sengaja TIDAK memakai library html2canvas / html-to-image. Library itu
// meng-clone DOM lalu menyalin gaya komputed ke dalam foreignObject SVG —
// rawan putus kalau ada CSS variable, font eksternal, atau elemen yang
// dirender di luar viewport. Di sini tabelnya memang sederhana (kotak teks),
// jadi menggambar sendiri lebih pendek, tanpa dependency, dan hasilnya sama
// di mana pun.
//
// Warna diambil dari CSS variable di :root supaya gambar ikut tema app
// (hijau toska), bukan warna hardcode yang bisa beda suatu saat.
//
// Seluruh perhitungan tata letak memakai satuan piksel CSS. Kanvas diberi
// ctx.scale(devicePixelRatio) sekali di awal, jadi semua koordinat di bawah
// bisa ditulis dalam piksel CSS tanpa mengalikan satu per satu.
//
// Client-side saja: memakai document / canvas, jadi file ini hanya boleh
// diimpor dari komponen "use client".
//
// Menyimpan gambar:
// - Di WebView Capacitor, klik link download (a.download + blob URL) DIABAIKAN
//   — tidak muncul apa-apa. Karena itu PNG ditulis ke folder Dokumen/Gambar
//   lewat @capacitor/filesystem, lalu langsung dibuka share sheet
//   (@capacitor/share) supaya bibi bisa kirim ke WhatsApp dll.
// - Fallback browser (vite dev) tetap pakai download link biasa.

import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export type Perataan = "left" | "right" | "center";

export type KolomEkspor = {
  label: string;
  align?: Perataan;
  /** Lebar minimum kolom dalam piksel CSS. Lebar akhir = isi terlebar. */
  lebarMin?: number;
};

export type DataEkspor = {
  /** Judul di paling atas gambar. */
  judul: string;
  /** Baris kecil di bawah judul, mis. filter yang sedang aktif. */
  subjudul?: string;
  kolom: KolomEkspor[];
  /** Tiap baris harus sepanjang `kolom`. null / undefined digambar "-". */
  baris: (string | number | null | undefined)[][];
  /** Baris kaki: asal data. */
  catatan?: string;
};

type Tema = {
  latar: string;
  permukaan: string;
  permukaan2: string;
  garis: string;
  garisKuat: string;
  teks: string;
  teksLembut: string;
  aksenGelap: string;
  aksenLembut: string;
  font: string;
};

// Semua dalam piksel CSS.
const PAD_X = 28;
const PAD_Y = 24;
const PAD_KOL = 12;
const TINGGI_BARIS_MIN = 36;
const TINGGI_HEADER = 40;
const TINGGI_BARIS_TEKS = 18;
const TINGGI_SUB = 18;
const TINGGI_JUDUL = 22;
const TINGGI_KAKI_BARIS = 16;

// Lebar minimum gambar (piksel CSS) dan skala minimum. Tanpa ini lebar gambar
// mengikuti isi tabel: tabel sempit (mis. WARNA + beberapa ukuran) jadi gambar
// kecil yang judulnya terbungkus dua baris dan kakinya turun, sedangkan tabel
// lebar tampil lega. Nilai 800 = lebar gambar "Hasil Potong" yang dijadikan
// acuan. Skala minimum 2 menjaga ketajaman sama di HP berkepadatan rendah.
const LEBAR_MIN_GAMBAR = 800;
const SKALA_MIN = 2;
const SKALA_MAKS = 3;

// Bentuk font: "berat ukuran" saja, keluarga ditambahkan terpisah supaya
// tidak ada spasi ganda yang bikin parser canvas menolak seluruh string.
const F_JUDUL = "700 15px";
const F_SUB = "400 13px";
const F_HEADER = "700 12px";
const F_ISI = "400 13px";
const F_KAKI = "400 11px";

const CADANGAN: Record<keyof Omit<Tema, "font">, string> = {
  latar: "#f4f8f8",
  permukaan: "#ffffff",
  permukaan2: "#eef4f4",
  garis: "#dfe9e8",
  garisKuat: "#c8d9d8",
  teks: "#1e3a5f",
  teksLembut: "#5b7186",
  aksenGelap: "#0a756b",
  aksenLembut: "#f0fdfa",
};

function bacaVar(nama: string, cadangan: string): string {
  if (typeof window === "undefined") return cadangan;
  const v = getComputedStyle(document.documentElement).getPropertyValue(nama).trim();
  return v || cadangan;
}

function ambilTema(): Tema {
  const keluarga =
    typeof window === "undefined"
      ? "system-ui, sans-serif"
      : getComputedStyle(document.body).fontFamily;
  // Canvas menolak seluruh string kalau ada var(...) yang belum terisi.
  const font = !keluarga || keluarga.includes("var(") ? "system-ui, sans-serif" : keluarga;

  return {
    latar: bacaVar("--latar", CADANGAN.latar),
    permukaan: bacaVar("--permukaan", CADANGAN.permukaan),
    permukaan2: bacaVar("--permukaan-2", CADANGAN.permukaan2),
    garis: bacaVar("--garis", CADANGAN.garis),
    garisKuat: bacaVar("--garis-kuat", CADANGAN.garisKuat),
    teks: bacaVar("--teks", CADANGAN.teks),
    teksLembut: bacaVar("--teks-lembut", CADANGAN.teksLembut),
    aksenGelap: bacaVar("--aksen-gelap", CADANGAN.aksenGelap),
    aksenLembut: bacaVar("--aksen-lembut", CADANGAN.aksenLembut),
    font,
  };
}

function setFont(ctx: CanvasRenderingContext2D, spesifikasi: string, font: string): void {
  ctx.font = `${spesifikasi} ${font}`;
}

function formatNilai(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "-";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "-";
  return v;
}

/**
 * Pecah satu sel jadi beberapa baris teks supaya muat di lebar kolom.
 * Dipotong dulu per spasi; kata yang sendirian masih lebih lebar dari kolom
 * dipotong per karakter supaya tidak meluber ke kolom sebelah.
 *
 * Catatan: spasi beruntun dirapatkan jadi satu. Untuk tabel angka dan nama
 * ini tidak mengubah isi yang terbaca.
 */
function bungkusTeks(
  ctx: CanvasRenderingContext2D,
  teks: string,
  lebarMaks: number,
): string[] {
  const rapi = teks.trim().replace(/\s+/g, " ");
  if (rapi === "") return [""];

  const hasil: string[] = [];
  let sekarang = "";

  const simpan = () => {
    if (sekarang !== "") {
      hasil.push(sekarang);
      sekarang = "";
    }
  };

  for (const kata of rapi.split(" ")) {
    const uji = sekarang === "" ? kata : `${sekarang} ${kata}`;
    if (ctx.measureText(uji).width <= lebarMaks) {
      sekarang = uji;
      continue;
    }
    simpan();
    if (ctx.measureText(kata).width <= lebarMaks) {
      sekarang = kata;
      continue;
    }
    let potongan = "";
    for (const ch of kata) {
      if (potongan !== "" && ctx.measureText(potongan + ch).width > lebarMaks) {
        hasil.push(potongan);
        potongan = ch;
      } else {
        potongan += ch;
      }
    }
    sekarang = potongan;
  }
  simpan();
  return hasil.length > 0 ? hasil : [""];
}

/** Ubah teks jadi slug aman untuk nama file (huruf kecil, tanpa aksen/spasi). */
export function slugNama(teks: string): string {
  return (
    teks
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "tabel"
  );
}

/** Nama file PNG yang aman untuk download (huruf kecil, tanpa spasi), plus cap waktu. */
export function namaFilePng(judul: string, sekarang: Date = new Date()): string {
  const bersih = judul
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${bersih || "tabel"}_${capWaktuFile(sekarang)}.png`;
}

/**
 * Cap waktu untuk nama file: "Kamis-8-10-2026_2344"
 * = nama hari, tanggal, bulan (angka), tahun, lalu jam-menit (24 jam, waktu HP).
 *
 * Dulu cuma "Kamis-10-2026" (tanpa tanggal; 10 itu bulan), jadi setiap Kamis di
 * bulan yang sama namanya kembar dan file lama tertimpa. Tanggal + jam-menit
 * membuat nama unik per ekspor. Tanpa tanda kurung karena sebagian sistem
 * mengganti tanda kurung di nama file dengan garis bawah.
 */
export function capWaktuFile(n: Date = new Date()): string {
  const hari = n.toLocaleDateString("id-ID", { weekday: "long" }); // e.g. "Kamis"
  const tanggal = String(n.getDate());
  const bulan = String(n.getMonth() + 1);
  const tahun = String(n.getFullYear());
  const jam = String(n.getHours()).padStart(2, "0");
  const menit = String(n.getMinutes()).padStart(2, "0");
  return `${hari}-${tanggal}-${bulan}-${tahun}_${jam}${menit}`;
}

/**
 * Nama file PNG dengan tanggal, misal
 * "belum-di-setorkan_Kamis-8-10-2026_2344.png".
 */
export function namaFileTanggal(prefix: string, sekarang: Date = new Date()): string {
  const dasar = prefix.replace(/\.png$/i, "").replace(/^\p{P}+|\p{P}+$/gu, "").trim() || "tabel";
  return `${dasar}_${capWaktuFile(sekarang)}.png`;
}

/**
 * Nama file PNG untuk satu bagian (satu model): sisipkan slug model di depan
 * tanggal supaya tiap model jadi file terpisah, misal
 * "hasil-potong-mikro-iswara-adhe_Kamis-8-10-2026_2344.png".
 */
export function namaFileModel(prefix: string, modelNama: string, sekarang: Date = new Date()): string {
  const slug = slugNama(modelNama);
  const namaBlok = `${prefix}-${slug}`;
  return namaFileTanggal(namaBlok, sekarang);
}

/**
 * Pastikan nama file belum dipakai di Dokumen/Gambar. Kalau sudah ada, tambah
 * akhiran -2, -3, dst. supaya arsip lama tidak tertimpa. Dua ekspor dalam menit
 * yang sama pada model yang sama adalah satu-satunya kasus yang masih bisa
 * bentrok setelah cap waktu.
 *
 * Filesystem.stat melempar error kalau file tidak ada — itu yang dipakai sebagai
 * tanda "nama masih bebas". Kalau stat gagal karena alasan lain (misal izin),
 * nama dianggap bebas.
 */
export async function namaBelumDipakai(nama: string): Promise<string> {
  const titik = nama.lastIndexOf(".");
  const dasar = titik > 0 ? nama.slice(0, titik) : nama;
  const ekor = titik > 0 ? nama.slice(titik) : "";
  for (let i = 1; i <= 50; i++) {
    const calon = i === 1 ? nama : `${dasar}-${i}${ekor}`;
    try {
      await Filesystem.stat({ path: `Gambar/${calon}`, directory: Directory.Documents });
    } catch {
      return calon;
    }
  }
  return `${dasar}-${Date.now()}${ekor}`;
}

function lebarTotal(lebarKolom: number[]): number {
  return lebarKolom.reduce((s, v) => s + v, 0);
}

/**
 * Lebarkan kolom secara proporsional sampai gambar (kolom + padding kiri-kanan)
 * setidaknya selebar LEBAR_MIN_GAMBAR. Sisa pembulatan ditambahkan ke kolom
 * pertama. Tabel yang sudah cukup lebar tidak diubah.
 */
export function lebarkanKolomMinimum(lebarKolom: number[]): number[] {
  const target = LEBAR_MIN_GAMBAR - PAD_X * 2;
  const total = lebarTotal(lebarKolom);
  if (lebarKolom.length === 0 || total >= target) return lebarKolom;
  const faktor = target / total;
  const hasil = lebarKolom.map((v) => Math.floor(v * faktor));
  hasil[0] += target - lebarTotal(hasil);
  return hasil;
}

/** Skala kanvas: mengikuti kepadatan layar, tapi dijaga di antara SKALA_MIN dan SKALA_MAKS. */
export function hitungSkala(devicePixelRatio: number): number {
  return Math.min(Math.max(devicePixelRatio || 1, SKALA_MIN), SKALA_MAKS);
}

/**
 * Gambar tabel ke canvas lalu trigger download PNG.
 *
 * Dua fase, sengaja terpisah:
 * 1. Ukur — font dipasang dulu, baru lebar tiap kolom dihitung dari teks
 *    terlebar (header maupun isi) supaya tidak ada sel yang kepotong.
 * 2. Gambar — latar, blok judul, header berwarna aksen, baris
 *    berselang-seling, garis tipis antar sel, lalu kaki berisi asal data
 *    dan waktu cetak.
 */
export async function unduhTabelGambar(data: DataEkspor, namaFile?: string): Promise<void> {
  if (typeof document === "undefined" || data.kolom.length === 0) return;

  const tema = ambilTema();
  const skala = hitungSkala(window.devicePixelRatio);

  const ukur = document.createElement("canvas");
  const uctx = ukur.getContext("2d");
  if (!uctx) return;

  const teksPerSel = data.kolom.map((_, ci) =>
    data.baris.map((baris) => formatNilai(baris[ci])),
  );

  // ---- fase 1: ukur lebar kolom ----
  // Gambar dibuat mengikuti isi: lebar tabel ditentukan isi terlebar (dengan
  // batas atas) supaya nama/model/pemilik tidak dipaksa turun ke baris berikut
  // hanya karena layar HP sempit. Kanvas digambar selebar isi + padding, lalu
  // dikunci max supaya tidak melebar tak terkendali.
  setFont(uctx, F_ISI, tema.font);
  const lebarAlami = data.kolom.map((k, ci) => {
    const lebarHeader = uctx.measureText(k.label.toUpperCase()).width + PAD_KOL * 2;
    const lebarIsi = teksPerSel[ci].reduce(
      (m, t) => Math.max(m, uctx.measureText(t).width + PAD_KOL * 2),
      0,
    );
    return Math.max(lebarHeader, lebarIsi, k.lebarMin ?? 72);
  });

  // Lebar gambar = total lebar kolom + padding, dikunci 320..1500.
  const lebarGambar = Math.max(320, Math.min(1500, lebarTotal(lebarAlami) + PAD_X * 2));
  const lebarIsiAktual = lebarGambar - PAD_X * 2;

  let lebarKolom = lebarAlami;
  if (lebarTotal(lebarKolom) > lebarIsiAktual) {
    const adaRuang = lebarIsiAktual - 56 * data.kolom.length;
    const faktor = Math.max(adaRuang / lebarTotal(lebarKolom), 0.25);
    lebarKolom = lebarKolom.map((v) => Math.max(Math.floor(v * faktor), 56));
  }
  // Tabel sempit dilebarkan ke lebar minimum supaya judul muat satu baris dan
  // ukuran gambar seragam antar ekspor.
  lebarKolom = lebarkanKolomMinimum(lebarKolom);

  // ---- fase 1b: bungkus isi sesuai lebar akhir ----
  const isiPerKolom = data.kolom.map((_, ci) => {
    const maks = Math.max(lebarKolom[ci] - PAD_KOL * 2, 8);
    return teksPerSel[ci].map((t) => bungkusTeks(uctx, t, maks));
  });

  // Judul juga bisa kebungkus (misal ada nama model yang panjang), biar tidak
  // meluber keluar sisi kanvas. Lebar maks sumber: lebar total kolom.
  // Ukur dengan font judul (700 15px), bukan font isi — teks digambar pakai
  // font judul; kalau diukur pakai font isi hasilnya kekecilan, judul tidak
  // kebungkus dan kepotong di tepi kanvas.
  setFont(uctx, F_JUDUL, tema.font);
  const barisJudul = bungkusTeks(uctx, data.judul, lebarTotal(lebarKolom));
  const tambahTinggiJudul = (barisJudul.length - 1) * TINGGI_JUDUL;

  // Subjudul (nama pemilik) juga — ukur dengan font sub + dibungkus, supaya
  // nama panjang tidak keluar tepi.
  setFont(uctx, F_SUB, tema.font);
  const barisSub = data.subjudul ? bungkusTeks(uctx, data.subjudul, lebarTotal(lebarKolom)) : [];
  const tambahTinggiSub = Math.max(barisSub.length - 1, 0) * TINGGI_SUB;

  // Tinggi baris: berapa baris teks terpanjang di baris itu, minimum setara
  // satu baris teks plus ruang napas.
  const tinggiBaris = data.baris.map((_, ri) => {
    const baris = data.kolom.map((_, ci) => isiPerKolom[ci][ri]?.length ?? 1);
    const maks = Math.max(1, ...baris);
    return Math.max(TINGGI_BARIS_MIN, maks * TINGGI_BARIS_TEKS + 18);
  });

  // ---- fase 1c: susun kaki (catatan + waktu cetak) ----
  // Satu baris kalau muat di lebar tabel; kalau tidak, waktu cetak turun ke
  // baris berikut. Dulu digambar berdampingan tanpa cek lebar, jadi pada
  // tabel sempit "Dicetak ..." kepotong di tepi kanvas.
  setFont(uctx, F_KAKI, tema.font);
  const waktu = new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });
  const capWaktu = `Dicetak ${waktu}`;
  const lebarMaksKaki = lebarTotal(lebarKolom);
  const barisKaki: { teks: string; dx: number }[][] = [];
  if (
    data.catatan &&
    uctx.measureText(data.catatan).width + 16 + uctx.measureText(capWaktu).width <=
      lebarMaksKaki
  ) {
    barisKaki.push([
      { teks: data.catatan, dx: 0 },
      { teks: capWaktu, dx: 16 },
    ]);
  } else {
    if (data.catatan) {
      for (const t of bungkusTeks(uctx, data.catatan, lebarMaksKaki)) {
        barisKaki.push([{ teks: t, dx: 0 }]);
      }
    }
    barisKaki.push([{ teks: capWaktu, dx: 0 }]);
  }

  // ---- fase 2: susun ukuran kanvas ----
  const tinggiKepala =
    PAD_Y +
    TINGGI_JUDUL +
    tambahTinggiJudul +
    (barisSub.length > 0 ? TINGGI_SUB + tambahTinggiSub : 0) +
    12;
  const tinggiKaki = 10 + barisKaki.length * TINGGI_KAKI_BARIS + PAD_Y;
  const tinggiTotalCss =
    tinggiKepala + TINGGI_HEADER + tinggiBaris.reduce((s, v) => s + v, 0) + tinggiKaki;
  const lebarTotalCss = lebarTotal(lebarKolom) + PAD_X * 2;

  const kanvas = document.createElement("canvas");
  kanvas.width = Math.max(Math.round(lebarTotalCss * skala), 1);
  kanvas.height = Math.max(Math.round(tinggiTotalCss * skala), 1);
  const ctx = kanvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(skala, skala);

  const x0 = PAD_X;
  const lebarTabel = lebarTotal(lebarKolom);

  // latar
  ctx.fillStyle = tema.latar;
  ctx.fillRect(0, 0, lebarTotalCss, tinggiTotalCss);

  // judul + subjudul
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  let y = PAD_Y;
  setFont(ctx, F_JUDUL, tema.font);
  ctx.fillStyle = tema.teks;
  for (const lapisan of barisJudul) {
    ctx.fillText(lapisan, x0, y);
    y += TINGGI_JUDUL;
  }
  if (barisSub.length > 0) {
    setFont(ctx, F_SUB, tema.font);
    ctx.fillStyle = tema.teksLembut;
    for (const lapisan of barisSub) {
      ctx.fillText(lapisan, x0, y);
      y += TINGGI_SUB;
    }
  }
  y += 12;

  const yTabel = y;

  // badan tabel (latar putih)
  ctx.fillStyle = tema.permukaan;
  ctx.fillRect(x0, yTabel, lebarTabel, TINGGI_HEADER + tinggiBaris.reduce((s, v) => s + v, 0));

  // kepala tabel
  ctx.fillStyle = tema.aksenLembut;
  ctx.fillRect(x0, yTabel, lebarTabel, TINGGI_HEADER);

  setFont(ctx, F_HEADER, tema.font);
  ctx.fillStyle = tema.aksenGelap;
  ctx.textBaseline = "middle";
  let cx = x0;
  for (let ci = 0; ci < data.kolom.length; ci++) {
    const k = data.kolom[ci];
    const w = lebarKolom[ci];
    const align = k.align ?? "left";
    ctx.textAlign = align === "right" ? "right" : align === "center" ? "center" : "left";
    const tx =
      align === "right" ? cx + w - PAD_KOL : align === "center" ? cx + w / 2 : cx + PAD_KOL;
    ctx.fillText(k.label.toUpperCase(), tx, yTabel + TINGGI_HEADER / 2);
    cx += w;
  }

  // isi
  setFont(ctx, F_ISI, tema.font);
  let yBaris = yTabel + TINGGI_HEADER;
  for (let ri = 0; ri < data.baris.length; ri++) {
    const tinggi = tinggiBaris[ri];
    if (ri % 2 === 1) {
      ctx.fillStyle = tema.permukaan2;
      ctx.fillRect(x0, yBaris, lebarTabel, tinggi);
    }
    ctx.fillStyle = tema.teks;
    cx = x0;
    for (let ci = 0; ci < data.kolom.length; ci++) {
      const k = data.kolom[ci];
      const w = lebarKolom[ci];
      const align = k.align ?? "left";
      ctx.textAlign = align === "right" ? "right" : align === "center" ? "center" : "left";
      const tx =
        align === "right" ? cx + w - PAD_KOL : align === "center" ? cx + w / 2 : cx + PAD_KOL;
      const baris = isiPerKolom[ci][ri] ?? [""];
      const tinggiTeks = baris.length * TINGGI_BARIS_TEKS;
      let ty = yBaris + (tinggi - tinggiTeks) / 2 + TINGGI_BARIS_TEKS / 2;
      for (const lapisan of baris) {
        ctx.fillText(lapisan, tx, ty);
        ty += TINGGI_BARIS_TEKS;
      }
      cx += w;
    }
    ctx.strokeStyle = tema.garis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, yBaris + tinggi + 0.5);
    ctx.lineTo(x0 + lebarTabel, yBaris + tinggi + 0.5);
    ctx.stroke();
    yBaris += tinggi;
  }

  // garis vertikal antar kolom
  ctx.strokeStyle = tema.garis;
  cx = x0;
  for (let ci = 0; ci < data.kolom.length - 1; ci++) {
    cx += lebarKolom[ci];
    ctx.beginPath();
    ctx.moveTo(cx + 0.5, yTabel + TINGGI_HEADER);
    ctx.lineTo(cx + 0.5, yBaris);
    ctx.stroke();
  }

  // garis tebal: bawah kepala + luar tabel
  ctx.strokeStyle = tema.garisKuat;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, yTabel + TINGGI_HEADER + 0.5);
  ctx.lineTo(x0 + lebarTabel, yTabel + TINGGI_HEADER + 0.5);
  ctx.stroke();
  ctx.strokeRect(x0 + 0.5, yTabel + 0.5, lebarTabel - 1, yBaris - yTabel - 1);

  // kaki: asal data + waktu cetak — susunan baris sudah dihitung fase 1c
  setFont(ctx, F_KAKI, tema.font);
  ctx.fillStyle = tema.teksLembut;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  let yKaki = yBaris + 10;
  for (const baris of barisKaki) {
    let x = x0;
    for (const seg of baris) {
      x += seg.dx;
      ctx.fillText(seg.teks, x, yKaki);
      x += ctx.measureText(seg.teks).width;
    }
    yKaki += TINGGI_KAKI_BARIS;
  }

  // ---- simpan ----
  const nama = namaFile ?? namaFilePng(data.judul);
  await simpanGambar(kanvas, nama);
}

/** Simpan canvas jadi PNG, lalu buka share. Kembalikan error kalau gagal. */
async function simpanGambar(kanvas: HTMLCanvasElement, namaAsli: string): Promise<void> {
  let nama = namaAsli;
  const blobP: Promise<Blob> = new Promise((resolve, reject) => {
    kanvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas gagal dikonversi ke PNG"))), "image/png");
  });
  const blob = await blobP;

  // WebView Capacitor: tulis ke folder Dokumen/Gambar (arsip permanen) lalu
  // share. Share lewat @capacitor/share di Android hanya bisa membaca file di
  // direktori Cache (FileProvider bawaan cuma meng-cover files en cache path),
  // jadi file di-copy dulu ke cache, di-share, lalu dihapus dari cache.
  if (Capacitor.isNativePlatform()) {
    nama = await namaBelumDipakai(namaAsli); // jangan menimpa arsip lama
    const base64 = (await blobToDataUrl(blob)).split(",")[1]; // potong prefix data:image/png;base64,
    const path = `Gambar/${nama}`;
    await Filesystem.writeFile({
      path,
      data: base64,
      directory: Directory.Documents,
      recursive: true,
    });

    await Filesystem.writeFile({
      path: nama,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    });
    try {
      const uri = (await Filesystem.getUri({ path: nama, directory: Directory.Cache })).uri;
      await Share.share({
        title: nama,
        text: nama,
        dialogTitle: "Simpan / bagikan gambar",
        files: [uri],
      });
    } finally {
      await Filesystem.deleteFile({ path: nama, directory: Directory.Cache }).catch(() => {});
    }
    return;
  }

  // Fallback browser (vite dev): download link biasa.
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nama;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Blob -> data URL (async, supaya file besar tidak memblokir). */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error ?? new Error("Gagal baca gambar"));
    fr.readAsDataURL(blob);
  });
}
