# Web App Management Konveksi

Aplikasi web untuk mencatat **bahan jahitan yang dibawa penjahit** dan **setoran hasil jahitan** pada usaha jasa jahit (konveksi), lengkap dengan perhitungan **sisa yang belum disetor** per penjahit.

> Dokumen ini merangkum seluruh perencanaan, keputusan teknis, dan langkah setup yang sudah dikerjakan, supaya proyek bisa dilanjutkan kapan saja tanpa mengulang diskusi.

---

## Daftar Isi

1. [Latar belakang dan tujuan](#1-latar-belakang-dan-tujuan)
2. [Aturan dan kebutuhan](#2-aturan-dan-kebutuhan)
3. [Fitur](#3-fitur)
4. [Sistem yang digunakan](#4-sistem-yang-digunakan)
5. [Keputusan teknis dan alasannya](#5-keputusan-teknis-dan-alasannya)
6. [Desain database](#6-desain-database)
7. [Struktur folder](#7-struktur-folder)
8. [Environment variables](#8-environment-variables)
9. [Langkah setup (step by step)](#9-langkah-setup-step-by-step)
10. [Deploy ke Cloudflare](#10-deploy-ke-cloudflare)
11. [Batasan penting di Cloudflare Workers](#11-batasan-penting-di-cloudflare-workers)
12. [Status progres](#12-status-progres)
13. [Rencana tahapan pengerjaan](#13-rencana-tahapan-pengerjaan)
14. [Troubleshooting](#14-troubleshooting)
15. [Backup dan keamanan](#15-backup-dan-keamanan)
16. [Hal yang belum diverifikasi](#16-hal-yang-belum-diverifikasi)

---

## 1. Latar belakang dan tujuan

Usaha ini adalah **jasa jahit**. Pemilik order (disebut **pemilik**) memberikan bahan, lalu penjahit mengerjakannya. Sebagian penjahit adalah **penjahit luar** yang membawa bahan pulang dan menjahit di rumah masing-masing, kemudian **menyetor** hasilnya.

Masalah yang diselesaikan:

- Mencatat berapa bahan yang dibawa tiap penjahit (per model, warna, dan ukuran).
- Mencatat setiap setoran hasil jahitan.
- Mengetahui **sisa yang belum disetor** tiap penjahit secara otomatis.

## 2. Aturan dan kebutuhan

Hasil diskusi perencanaan:

| Topik | Keputusan |
|---|---|
| Jenis usaha | Jasa jahit, jadi **pencatatan reject tidak diperlukan** |
| Identitas barang | **Pemilik** (pemilik baju) + **model baju** + **warna** + **ukuran** |
| Ukuran yang dipakai | `XS, S, M, L, XL, 2L, 3L, 5L, 8L` (4L, 6L, 7L tidak dipakai) |
| Input jumlah | Tabel jumlah per ukuran, jadi satu catatan bisa berisi banyak ukuran sekaligus |
| Data master | Pemilik, model, warna, dan penjahit **bisa ditambah dan diedit sendiri lewat web** |
| Pengguna | **2 akun**: 1 pemakai harian dan 1 admin/developer. Penjahit dan pemilik tidak login |
| Biaya | Database dan hosting harus **gratis** |
| Repo | **Privat** |

## 3. Fitur

### Fitur 1: Setoran
Mencatat hasil jahitan yang disetor penjahit.
Data: tanggal, penjahit, pemilik, model, warna, jumlah per ukuran.

### Fitur 2: Bahan dibawa (bahan keluar)
Mencatat bahan yang dibawa penjahit luar untuk dijahit di rumah.
Data: tanggal, penjahit, pemilik, model, warna, jumlah per ukuran (contoh: XL 67 pcs).

### Fitur turunan: Sisa belum disetor
Dihitung otomatis, **tidak disimpan**:

```
sisa = SUM(jumlah bahan keluar) - SUM(jumlah setoran)
       dikelompokkan per penjahit + model + warna + ukuran
```

### Data master
CRUD untuk pemilik, model baju, warna, dan penjahit. Data yang tidak dipakai lagi **dinonaktifkan, bukan dihapus**, supaya riwayat transaksi lama tetap utuh.

## 4. Sistem yang digunakan

| Lapisan | Teknologi | Keterangan |
|---|---|---|
| Framework | **Next.js** (App Router, TypeScript, Tailwind) | Frontend dan API dalam satu project |
| Database | **Neon** (PostgreSQL serverless) | Tier gratis, scale-to-zero |
| ORM | **Prisma 6** (6.19.3) | Disambung ke Neon lewat `@prisma/adapter-neon` |
| Hosting | **Cloudflare Workers** | Lewat adapter **OpenNext** (`@opennextjs/cloudflare`) |
| Login | Session cookie | Password di-hash PBKDF2-HMAC-SHA256 210.000 iterasi lewat Web Crypto, 2 akun |
| Validasi input | **zod** | Semua validasi request, pesan error langsung bahasa Indonesia |
| Repo | **GitHub (privat)** | Auto-deploy dari Cloudflare direncanakan |
| Lingkungan kerja | **GitHub Codespaces**, diakses lewat **Termux (SSH)** dari HP | Tidak ada laptop |
| Bantuan kode | **GitHub Copilot** | Dipakai membuat struktur folder awal |
| Penjaga sesi terminal | **tmux** | Supaya `npm run dev` tidak mati saat koneksi putus |

## 5. Keputusan teknis dan alasannya

### Mengapa Next.js
Satu project untuk frontend dan API, paling sederhana untuk dikelola sendirian.

### Mengapa Neon
Postgres gratis permanen tanpa kartu kredit, dan database tidur saat tidak dipakai lalu bangun lagi dengan cepat. Data aplikasi hanya teks dan angka, jadi kuota storage gratis sangat lega. Pembanding: Supabase juga gratis, tapi project gratisnya otomatis pause setelah seminggu tidak aktif.

### Mengapa Cloudflare (sementara)
Hosting gratis yang **mengizinkan pemakaian komersial** dan tidak membatasi bandwidth. Pembanding yang sudah dipertimbangkan:

| Platform | Catatan |
|---|---|
| Vercel (Hobby) | Paling mulus untuk Next.js, tapi plan Hobby **non-komersial**, kurang cocok untuk app usaha |
| Netlify | Komersial diizinkan, tier gratis berbasis credit (300 credit per bulan), dukungan Next.js baik. Jadi opsi cadangan |
| Cloudflare | Dipilih untuk saat ini. Setup lebih teknis karena lewat adapter OpenNext |
| Hosting PHP gratis (mis. InfinityFree) | Ditolak karena akan mengubah stack total menjadi PHP, dan sumber dayanya terbatas |

Karena database terpisah di Neon dan stack-nya portabel, pindah hosting nanti hanya perlu deploy ulang.

### Mengapa adapter OpenNext, bukan vinext
Saat `create-cloudflare` ditanya soal adapter, tool menandai **vinext** sebagai "recommended". Pilihan yang diambil adalah **OpenNext** karena adapter ini sudah GA (1.0 sejak Februari 2026), seluruh aturan di dokumen ini mengikuti dokumentasinya, dan jalur Prisma + Neon di Workers sudah dicek. Kematangan vinext belum diverifikasi.

### Mengapa Prisma di-pin ke versi 6
Konfigurasi Prisma versi lebih baru berbeda (memakai `prisma.config.ts`). Skema dan kode di repo ini ditulis untuk Prisma 6.

## 6. Desain database

Ukuran dikunci di **enum** (tidak perlu tabel sendiri). Nama enum tidak boleh diawali angka, jadi `2L/3L/5L/8L` dipetakan lewat `@map` menjadi `L2/L3/L5/L8` di kode.

| Tabel | Isi |
|---|---|
| `User` | username (unik), passwordHash. Hanya 2 akun |
| `Pemilik` | nama (unik), aktif |
| `ModelBaju` | nama, pemilikId, aktif. Unik per kombinasi (pemilikId, nama) |
| `Warna` | nama (unik), aktif |
| `Penjahit` | nama (unik), aktif |
| `Transaksi` | tanggal, jenis, penjahitId, modelId, warnaId, catatan |
| `TransaksiItem` | transaksiId, ukuran, jumlah. Unik per (transaksiId, ukuran) |

`Transaksi.jenis` bernilai `BAHAN_KELUAR` (fitur 2) atau `SETORAN` (fitur 1). Dua fitur memakai satu tabel dan satu komponen form karena strukturnya sama.

File skema: `prisma/schema.prisma`. Blok datasource memakai dua URL:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // pooled, dipakai app saat runtime
  directUrl = env("DIRECT_URL")     // direct, dipakai migrasi
}
```

## 7. Struktur folder

```
src/
  app/
    layout.tsx
    globals.css
    (auth)/
      layout.tsx
      login/
        page.tsx
        LoginForm.tsx
    (app)/
      layout.tsx              # pengecekan login dilakukan di sini
      LogoutButton.tsx
      page.tsx                # dashboard
      setoran/page.tsx        # placeholder
      bahan-keluar/page.tsx    # placeholder
      sisa/page.tsx           # placeholder
      master/
        pemilik/page.tsx      # placeholder
        model/page.tsx        # placeholder
        warna/page.tsx        # placeholder
        penjahit/page.tsx     # placeholder
    api/
      auth/login/route.ts
      auth/logout/route.ts
      master/[entity]/route.ts
      master/[entity]/[id]/route.ts
      transaksi/route.ts
      transaksi/[id]/route.ts
      sisa/route.ts
      health/route.ts         # cek koneksi database, publik
  components/
    forms/TransaksiForm.tsx   # dipakai ulang untuk setoran dan bahan keluar
    forms/UkuranTable.tsx     # tabel input jumlah per ukuran
    ui/Button.tsx
    ui/Input.tsx
    ui/Table.tsx
  lib/
    db.ts                     # Prisma client + adapter Neon
    api.ts                    # format respons error, pemetaan error Prisma
    request.ts                # penjaga sesi, proteksi Origin, parsing body
    auth.ts                   # session cookie HMAC-SHA256
    auth-password.ts          # PBKDF2-HMAC-SHA256 lewat Web Crypto
    tanggal.ts                # tanggal kalender WIB
    ukuran.ts                 # daftar ukuran, pemetaan label ke enum
    validators.ts             # skema zod
    master.ts                 # logika data master
    transaksi.ts              # logika transaksi
    sisa.ts                   # query sisa lewat SQL mentah
prisma/
  schema.prisma
  seed.ts                     # membuat 2 akun awal
  ganti-password.ts           # ganti password lewat terminal
  migrations/                 # dibuat otomatis oleh prisma migrate
scripts/
  smoke-test.sh               # 91 pemeriksaan API lewat curl
  smoke-cleanup.ts            # hapus data uji berawalan TES-
docs/
  API.md                      # kontrak API untuk sesi frontend
```

Folder dan file di `src/components/` sudah ada, tapi isinya masih stub placeholder tiga baris, sama seperti semua halaman `(app)` selain login. Sesi frontend tinggal mengisi, tidak perlu membuat dari nol.

Struktur awal dibuat oleh GitHub Copilot memakai prompt khusus, dengan aturan: tanpa `middleware.ts`, tanpa edge runtime, tanpa mengubah skema.

## 8. Environment variables

File `.env` di root project (**tidak boleh di-commit**, pastikan ada di `.gitignore`):

```
DATABASE_URL="postgresql://...-pooler...?sslmode=require"
DIRECT_URL="postgresql://...?sslmode=require"
SESSION_SECRET="<string acak panjang, buat sendiri>"
SEED_USER_USERNAME="<akun awal>"
SEED_USER_PASSWORD="<password awal>"
```

| Variabel | Sumber | Fungsi |
|---|---|---|
| `DATABASE_URL` | Neon, tombol Connect, **Connection pooling aktif** (hostname ada `-pooler`) | Dipakai app saat runtime lewat adapter Neon |
| `DIRECT_URL` | Neon, tombol Connect, **Connection pooling mati** | Dipakai `prisma migrate` |
| `SESSION_SECRET` | Dibuat sendiri, mis. hasil `openssl rand -hex 32` | Kunci penanda tangan cookie session. Kalau kosong atau berubah, semua sesi lama jadi tidak valid |
| `SEED_USER_USERNAME` | Dibuat sendiri | Username akun yang dibuat `prisma/seed.ts` |
| `SEED_USER_PASSWORD` | Dibuat sendiri | Password akun yang dibuat `prisma/seed.ts` |

Saat deploy, `DATABASE_URL` **dan** `SESSION_SECRET` harus diisi sebagai variabel lingkungan di Cloudflare. Cek dengan:

```bash
git check-ignore .env      # harus mencetak .env
grep -c "_URL=" .env       # harus mencetak 2
```

## 9. Langkah setup (step by step)

Semua perintah dijalankan di terminal Codespace (lewat Termux SSH). Disarankan memakai tmux:

```bash
sudo apt update && sudo apt install -y tmux
tmux new -s kerja
```

Dasar tmux: jendela baru `Ctrl+B` lalu `C`, pindah jendela `Ctrl+B` lalu `N`/`P`, keluar tanpa mematikan sesi `Ctrl+B` lalu `D`, masuk lagi `tmux attach -t kerja`.

### Langkah 0: Persiapan akun dan repo
1. Buat repo GitHub **privat**.
2. Buka repo, klik Code, Codespaces, Create codespace on main.
3. Buat project di Neon (pilih region terdekat, mis. Singapore bila tersedia), lalu ambil dua connection string (pooled dan direct).

### Langkah 1: Pasang Prisma (pin ke versi 6)

```bash
npm install @prisma/client@6 @prisma/adapter-neon@6
npm install -D prisma@6
npx prisma -v        # harus menampilkan prisma dan @prisma/client berawalan 6.
```

### Langkah 2: Isi `.env`

```bash
nano .env
```

Isi `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `SEED_USER_USERNAME`, dan `SEED_USER_PASSWORD` (lihat bagian 8). Simpan: `Ctrl+O`, Enter, `Ctrl+X`.

### Langkah 3: Pastikan skema ada dan punya `directUrl`

File `prisma/schema.prisma` harus ada di repo. Kalau file diunggah lewat web GitHub, tarik ke Codespace dulu:

```bash
cd /workspaces/konveksi-management
git pull
find . -name schema.prisma -not -path "./node_modules/*"
```

Tambahkan `directUrl` (jalankan **sekali saja**, cek dulu dengan `grep -c "directUrl" prisma/schema.prisma`):

```bash
sed -i '/env("DATABASE_URL")/a\  directUrl = env("DIRECT_URL")' prisma/schema.prisma
grep -n -A4 "datasource" prisma/schema.prisma
npx prisma validate      # harus menyatakan skema valid
```

### Langkah 4: Buat tabel di Neon

```bash
npx prisma migrate dev --name init
```

Hasilnya: folder `prisma/migrations/` terbentuk, semua tabel dibuat di Neon, dan Prisma Client di-generate. Cek di dashboard Neon, menu Tables.

### Langkah 5: Tulis `src/lib/db.ts`

```bash
cat > src/lib/db.ts <<'EOF'
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

export function getDb() {
  const adapter = new PrismaNeon({
    connectionString: process.env.DATABASE_URL!,
  });
  return new PrismaClient({ adapter });
}
EOF
```

### Langkah 6: Pastikan project Next.js benar-benar terbentuk

Saat dicek, `package.json` hanya berisi paket Prisma (tanpa Next.js dan tanpa script `dev`), karena Copilot hanya membuat folder dan file placeholder. Perbaikannya: buat project template di folder sementara, lalu gabungkan ke repo tanpa menimpa file yang sudah ada.

```bash
# 1. Buat template di folder sementara
cd /tmp
npm create cloudflare@latest konveksi-app -- --framework=next --platform=workers
```

Pilihan saat wizard berjalan:

| Pertanyaan | Jawaban |
|---|---|
| Adapter Next.js | **OpenNext adapter** (bukan vinext) |
| Pakai folder `src/` | Yes |
| TypeScript dan Tailwind | Yes |
| Deploy sekarang | No |
| Inisialisasi git | No |

```bash
# 2. Cek hasilnya (harus ada src/app)
ls -a /tmp/konveksi-app
ls /tmp/konveksi-app/src/app

# 3. Gabungkan ke repo tanpa menimpa file kita
rm -rf /tmp/konveksi-app/node_modules /tmp/konveksi-app/.git
cd /workspaces/konveksi-management
rm -f package.json package-lock.json
cp -rn /tmp/konveksi-app/. ./

# 4. Hapus halaman bawaan template (bentrok dengan src/app/(app)/page.tsx)
rm -f src/app/page.tsx

# 5. Pasang semua paket dari awal
npm install
npm install @prisma/client@6 @prisma/adapter-neon@6
npm install -D prisma@6

# 6. Verifikasi
grep -A8 '"scripts"' package.json      # harus ada script dev
grep -n '@/' tsconfig.json             # harus ada alias "@/*": ["./src/*"]
git check-ignore .env                  # harus mencetak .env
```

### Langkah 7: Tes koneksi database

Route health sudah ada di repo (`src/app/api/health/route.ts`) dan isinya sudah diperbarui: ia tidak lagi mengirim jumlah data, hanya `{ ok: true }` atau `{ ok: false }`, supaya endpoint publik ini tidak membocorkan isi database.

Jalankan app di jendela tmux pertama, lalu tes dari jendela kedua:

```bash
npm run dev
# jendela kedua:
curl localhost:3000/api/health
```

Hasil yang diharapkan: `{"ok":true}`. Kalau port bukan 3000, lihat baris `Local:` di output `npm run dev`.

### Langkah 8: Commit dan push

```bash
git status                  # pastikan .env TIDAK ikut
git add .
git commit -m "setup awal: struktur, skema, koneksi neon"
git push
```

## 10. Deploy ke Cloudflare

Karena tidak ada laptop, jalur yang dipilih adalah **deploy otomatis dari GitHub**:

1. Di dashboard Cloudflare (bisa dibuka dari browser HP): Workers & Pages, buat project baru dari Git, pilih repo privat.
2. Isi `DATABASE_URL` (versi pooled) sebagai variabel lingkungan di Cloudflare.
3. Perintah build dan deploy mengikuti script `deploy` di `package.json`, yaitu `opennextjs-cloudflare build && opennextjs-cloudflare deploy` menurut dokumentasi OpenNext.
4. Setiap `git push` ke branch utama men-deploy ulang.

Catatan: login `wrangler` dari terminal Codespace biasanya bermasalah karena proses login memakai alamat localhost. Alternatifnya memakai API token Cloudflare lewat variabel lingkungan (cek dokumen Wrangler untuk detail).

## 11. Batasan penting di Cloudflare Workers

- **Jangan membuat `middleware.ts`.** Middleware Node.js belum didukung adapter. Pengecekan login dilakukan di `src/app/(app)/layout.tsx` atau di tiap route handler.
- **Jangan memakai edge runtime** (`export const runtime = 'edge'`) di route mana pun. Adapter hanya mendukung runtime Node.
- **Prisma harus lewat driver adapter** (`@prisma/adapter-neon`) di Workers.
- Koneksi runtime memakai string **pooled** (`-pooler`), migrasi memakai **direct**.

## 12. Status progres

| Item | Status |
|---|---|
| Perencanaan fitur, aturan, dan stack | Selesai |
| Skema database (`schema.prisma`) | Selesai, sudah valid (`prisma validate`) |
| Struktur folder oleh Copilot | Selesai |
| Project Neon | Dibuat |
| Codespace dari repo privat, akses via Termux | Siap |
| Prisma 6.19.3 terpasang | Selesai |
| `.env` terisi | Diisi (dicek dengan `grep -c "_URL=" .env`) |
| `directUrl` ditambahkan ke skema | Selesai |
| Migrasi `init` | Selesai (folder `prisma/migrations/20261004201203_init`) |
| `src/lib/db.ts` | Selesai, sesuai Langkah 5 |
| Project Next.js template | Selesai, dibuat di `/tmp/konveksi-app` (Next 16.3.8, React 19, Tailwind v4, OpenNext `^1.20.3`) |
| Penggabungan template ke repo | Selesai (step 6: `cp -rn`, `src/app/page.tsx` template dihapus) |
| Verifikasi alias `@/*` di `tsconfig.json` | Selesai (`"@/*": ["./src/*"]`) |
| Verifikasi `.env` ter-ignore git | Selesai (`git check-ignore .env` = `.env`) |
| **Tahap 2: Login** | **Selesai**. PBKDF2-HMAC-SHA256 210.000 iterasi lewat Web Crypto, session cookie HMAC-SHA256 7 hari, `prisma/seed.ts` dan `prisma/ganti-password.ts`. Commit `576600d` |
| **Tahap 3: Data master** | **Selesai**. 4 entity lewat `/api/master/[entity]`, duplikat dicek insensitive huruf, master yang dipakai transaksi tidak bisa dinonaktifkan (409). Commit `d9e656b` |
| **Tahap 4: Transaksi** | **Selesai**. `/api/transaksi` dengan filter, pagination, PUT, DELETE. Item jumlah 0 dibuang, ukuran dobel ditolak. Commit `0528300` |
| **Tahap 5: Sisa belum disetor** | **Selesai**. Query agregasi di `src/lib/sisa.ts`, negatif tidak dipotong, baris sisa 0 disembunyikan bawaan. Commit `f1d7471` |
| **Rename boss menjadi pemilik** | **Selesai**. Skema, kolom, path API, dan field JSON. Migrasi `20261004222722_rename_boss_to_pemilik`. Commit `4f56a26` |
| **Smoke test API** | **Selesai**. 91 pemeriksaan, semuanya lulus. `scripts/smoke-test.sh`. Commit `22ffde8` |
| **Dokumentasi kontrak API** | **Selesai**. `docs/API.md`. Commit `a73b6d3` |
| Verifikasi `npx tsc --noEmit` dan `npx eslint .` | 0 error, dicek 2026-10-05 |
| Verifikasi database bersih setelah smoke test | Semua tabel master dan transaksi berisi 0 baris, `User` 1 baris |
| **Commit seluruh backend** | **Sudah di-push** ke `origin/main` (`5482c2c..a73b6d3`) |
| Halaman UI selain login | **Placeholder semua**. Folder dan file `src/components/` sudah ada tapi isinya masih stub, tinggal diisi |
| Deploy ke Cloudflare | Belum |

## 13. Rencana tahapan pengerjaan

1. **Setup dasar**: project Next.js, Prisma ke Neon. **Selesai**, kecuali deploy kosong ke Cloudflare yang belum.
2. **Login**: 2 akun dengan session cookie dan password di-hash. **Selesai**.
3. **Data master**: CRUD pemilik, model, warna, penjahit (tambah, edit, nonaktifkan). **Selesai** di sisi API.
4. **Fitur 1, Setoran**: form dengan tabel jumlah per ukuran dan daftar riwayat. API selesai, UI belum.
5. **Fitur 2, Bahan dibawa**: memakai komponen form yang sama, beda jenis transaksi. API selesai, UI belum.
6. **Sisa belum disetor**: halaman rekap per penjahit, model, warna, dan ukuran. API selesai, UI belum.
7. **Rapikan dan backup**: tampilan mobile, filter, dan prosedur export database berkala.

Urutan 1 sampai 3 didahulukan karena semua fitur bergantung pada fondasi itu. Seluruh API untuk tahap 4 sampai 6 sudah jadi, teruji, dan sudah di-push, jadi sesi berikutnya tinggal membangun UI di atasnya. Kontraknya ada di `docs/API.md`.

## 14. Troubleshooting

Masalah yang sudah ditemui selama setup:

| Gejala | Penyebab | Solusi |
|---|---|---|
| `schema.prisma` "No such file or directory" di SSH | File diunggah lewat web GitHub, belum ditarik ke Codespace | `git pull`, lalu `find . -name schema.prisma -not -path "./node_modules/*"` |
| `directUrl` muncul dua kali | Perintah `sed` dijalankan dua kali | Hapus salah satu baris dengan `nano prisma/schema.prisma` |
| `npm error Missing script: "dev"` | Project Next.js belum terbentuk, `package.json` hanya berisi Prisma | Ikuti Langkah 6 |
| Dua file halaman untuk alamat `/` | Template membawa `src/app/page.tsx` yang bentrok dengan `src/app/(app)/page.tsx` | `rm -f src/app/page.tsx` |

Masalah yang muncul saat mengerjakan API lewat SSH (semua sudah selesai):

| Gejala | Penyebab | Solusi |
|---|---|---|
| `environment is non-interactive, which is not supported` saat `prisma migrate dev` | Over SSH tidak ada TTY, jadi perintah interaktif ditolak | Buat SQL lebih dulu: `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > /tmp/m.sql`, buat folder `prisma/migrations/<timestamp>_<nama>/` manual, taruh SQL-nya, lalu `npx prisma migrate deploy` |
| `P2010 Failed to deserialize column of type 'name'` | `information_schema.table_name` bertipe `name`, tidak bisa di-deserialize Prisma | Cast di query: `WHERE table_name::text = 'xxx'`. Ini bukan masalah database |
| `Cannot read properties of undefined (reading 'findMany')` setelah ganti skema | Dev server masih menyimpan Prisma client lama di memori; `prisma generate` menulis ke `node_modules` tapi proses yang sudah jalan tidak hot-reload | Matikan dev server, jalankan `npx prisma generate`, hapus `.next/dev`, nyalakan ulang |
| "Another next dev server is already running" | Dua `next dev` di directory yang sama ditolak Next.js | Tidak bisa pakai port alternatif untuk tes. Matikan server lama dulu |
| Koneksi SSH ikut mati saat `pkill -f 'next-server'` | Pola `pkill` ikut cocok dengan string perintah shell itu sendiri, dan tmux server ikut ikut mati | Pakai `tmux kill-session -t <nama>`, atau kill per PID |

Kemungkinan error lain:

| Gejala | Solusi |
|---|---|
| `P1001 Can't reach database server` | Neon baru bangun dari tidur, ulangi perintah. Cek `DIRECT_URL` (tanpa `-pooler`, tanpa spasi atau baris baru) |
| Error soal `previewFeatures` atau `driverAdapters` | Tambahkan `previewFeatures = ["driverAdapters"]` di blok generator, hanya jika pesan error memintanya |
| `Table does not exist` saat tes `/api/health` | Migrasi belum sukses, ulangi `npx prisma migrate dev --name init` |
| Alias `@/lib/db` tidak ditemukan | Pastikan `tsconfig.json` punya `"@/*": ["./src/*"]` |
| `npm run dev` mati saat koneksi putus | Jalankan di dalam tmux |
| Proses mati setelah Codespace berhenti otomatis | Jalankan ulang `npm run dev`. Stop Codespace manual bila selesai agar tidak menghabiskan jatah |

## 15. Backup dan keamanan

- **Rahasia**: `.env` tidak boleh di-commit dan tidak boleh ditempel di chat atau issue. Connection string berisi password database.
- **Backup database**: tier gratis cocok selama kehilangan data bukan bencana. Karena ini data usaha, lakukan **export (dump) berkala**, misalnya sebulan sekali.
- **Kuota Codespaces**: akun gratis punya jatah jam per bulan. Cek halaman billing GitHub untuk jatah terbaru.
- **Kebijakan tier gratis bisa berubah**. Cek halaman pricing dan syarat layanan Neon dan Cloudflare secara berkala, termasuk syarat pemakaian komersial.
- **Mudah pindah**: stack (Next.js + Postgres) portabel. Bila hosting berubah, cukup deploy ulang ke platform lain.

## 16. Hal yang belum diverifikasi

Beberapa poin berikut berasal dari pengetahuan umum dan belum dikonfirmasi di dokumentasi resmi atau lewat percobaan langsung. Cek sebelum diandalkan:

- Penggunaan koneksi direct untuk migrasi dan pooled untuk runtime di **Workers** secara persis, sesuai panduan Neon. Di Codespaces sudah terbukti jalan, tapi belum dicoba di Workers.
- Cara login Wrangler dengan API token dari lingkungan remote tanpa browser.
- Detail variabel lingkungan dan perintah build di Workers Builds untuk adapter OpenNext.
- Kematangan dan kompatibilitas **vinext** dibanding OpenNext.
- Syarat pemakaian komersial tier gratis Neon dan Cloudflare secara spesifik (hanya dibaca dari ulasan pihak ketiga, bukan syarat resmi).
- Batas 2 akun. Kalau nanti butuh lebih banyak, `prisma/schema.prisma` dan halaman login perlu diubah.

Pola `getDb()` yang membuat Prisma client baru tiap pemanggilan **sudah** terbukti jalan di Codespaces, tapi belum pernah dijalankan di Workers.
