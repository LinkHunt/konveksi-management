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
17. [Checklist deploy pertama ke Cloudflare](#17-checklist-deploy-pertama-ke-cloudflare)

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
2. Isi `DATABASE_URL` (versi pooled) **dan** `SESSION_SECRET` sebagai variabel lingkungan / secret di Cloudflare. Dua-duanya wajib: tanpa `SESSION_SECRET` proses login tidak bisa menandatangani cookie.
3. Perintah build dan deploy mengikuti script `deploy` di `package.json`, yaitu `opennextjs-cloudflare build && opennextjs-cloudflare deploy` menurut dokumentasi OpenNext.
4. Setiap `git push` ke branch utama men-deploy ulang.

Sebelum deploy, pastikan `prisma generate` sudah dijalankan dengan `engineType = "client"` aktif (lihat §11). Kalau lupa, worker akan gagal saat query pertama dengan pesan `could not locate the Query Engine`.

Catatan: login `wrangler` dari terminal Codespace biasanya bermasalah karena proses login memakai alamat localhost. Alternatifnya memakai API token Cloudflare lewat variabel lingkungan (cek dokumen Wrangler untuk detail).

Status deploy nyata: **belum pernah dijalankan**. Semua yang sudah terverifikasi (§14) hanya di workerd lokal lewat `npm run preview`, bukan di worker yang sudah online.

## 11. Batasan penting di Cloudflare Workers

- **Jangan membuat `middleware.ts`.** Middleware Node.js belum didukung adapter. Pengecekan login dilakukan di layout `(app)` atau di tiap route handler.
- **Jangan memakai edge runtime** (`export const runtime = 'edge'`) di route mana pun. Adapter hanya mendukung runtime Node.
- **Prisma harus lewat driver adapter** (`@prisma/adapter-neon`) di Workers.
- Koneksi runtime memakai string **pooled** (`-pooler`), migrasi memakai **direct**.

### Konfigurasi wajib Prisma di Workers

Tiga hal ini sudah terverifikasi jalan di runtime Workers lokal (lihat §12):

| Yang harus ada | Isinya | Kenapa wajib |
|---|---|---|
| `prisma/schema.prisma` | `engineType = "client"` di blok generator | Tanpa itu Prisma memuat query engine native `.node`, mustahil di workerd. Dengan `engineType = "client"` Prisma memakai WASM query compiler |
| `next.config.ts` | `output: "standalone"` | Tanpa ini `next build` dan OpenNext tidak menghasilkan `.next/standalone` |
| `next.config.ts` | `serverExternalPackages: ["@prisma/client", ".prisma/client"]` | Memastikan paket Prisma ikut ter-bundle ke dalam worker |

Contoh blok generator:

```prisma
generator client {
  provider   = "prisma-client-js"
  engineType = "client"
}
```

Contoh config Next.js:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
};

export default nextConfig;
```

### Yang ternyata tidak perlu

Dua hal ini sempat dicoba karena muncul di dokumentasi, tapi lewat uji pembalik (cabut lalu tes ulang) ketahuan tidak dibutuhkan. Jangan ditambahkan:

| Config | Hasil uji |
|---|---|
| `previewFeatures = ["driverAdapters"]` | Deprecated di Prisma 6.19.3 (`prisma validate` memberi warning). Driver adapter sudah GA |
| Env var `PRISMA_CLIENT_FORCE_WASM=1` | Cabut dari `.dev.vars`, semua endpoint tetap 200 |

### `nodejs_compat`: wajib menurut dokumen, tidak perlu menurut uji lokal

Dua bukti ini bertentangan, dan keduanya dicatat apa adanya:

| Bukti | Hasil |
|---|---|
| Uji pembalik di workerd lokal (flag dicabut, lalu semua endpoint dipanggil) | `/api/health` 200, login 200, transaksi 200, sisa 200. Tidak ada efek |
| Dokumentasi OpenNext (`opennext.js.org/cloudflare/get-started`) | "you must enable the `nodejs_compat` compatibility flag", dan flag itu ada di contoh `wrangler.jsonc` mereka |

**Keputusan: flag tetap dipasang**, mengikuti dokumen, karena:

1. Dokumentasi menyatakannya wajib, bukan saran.
2. Workerd lokal dan Workers produksi bisa berbeda dalam hal API Node.
3. Menambah flag yang tidak dipakai tidak merusak apa pun; mencabutnya saat produksi padahal dibutuhkan bisa merusak.

Kalau nanti terbukti tidak perlu, cabut saja. Uji pembalik sudah tercatat di §14.

### Variabel lokal untuk preview

Preview OpenNext memakai workerd lokal dan membaca rahasia dari **`.dev.vars`**, bukan `.env`:

```

# .dev.vars - JANGAN di-commit, sudah tercakup .gitignore
DATABASE_URL="postgresql://...-pooler...:5432/neondb"
SESSION_SECRET="..."
```

`.dev.vars` sudah ter-ignore git lewat baris `.dev.vars*` di `.gitignore`. Perintah untuk menjalankan:

```
npm run preview      # opennextjs-cloudflare build && opennextjs-cloudflare preview
```

Lalu tes dari port **8787** (bukan 3000):

```
curl http://localhost:8787/api/health
```

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
| Verifikasi `npx tsc --noEmit` | 0 error, dicek ulang 2026-10-05 setelah perubahan Workers |
| Verifikasi `npx eslint .` | 0 error dicek 2026-10-05 pagi. Sore hari proses lint timeout di Codespace sehingga tidak diulang. Perubahan hari ini hanya 2 file config, keduanya bukan TypeScript |
| Verifikasi database bersih setelah smoke test | Semua tabel master dan transaksi berisi 0 baris, `User` 1 baris |
| **Commit seluruh backend** | **Sudah di-push** ke `origin/main` (`5482c2c..a73b6d3`) |
| Halaman UI selain login | **Placeholder semua**. Folder dan file `src/components/` sudah ada tapi isinya masih stub, tinggal diisi |
| **Uji di runtime Workers lokal (OpenNext)** | **Selesai 2026-10-05**. `GET /api/health` 200, `POST /api/auth/login` 200 dengan cookie, endpoint master/transaksi/sisa semua 200, auth guard 401, logout 200. Jalur di `npm run preview` (workerd lokal port 8787). Detail hasil uji di §14 |
| **PBKDF2 210.000 iterasi di Workers** | **Terverifikasi aman**. Diuji 3x: 27-29 ms, tidak ada error, tidak mendekati batas CPU. Klaim batas 100.000 iterasi **tidak terbukti benar**. `auth-password.ts` tidak diubah |
| **Konfigurasi Workers di `next.config.ts` dan `schema.prisma`** | **Selesai**. `engineType = "client"`, `output: "standalone"`, `serverExternalPackages: ["@prisma/client", ".prisma/client"]`. `wrangler.jsonc` tidak perlu diubah |
| Deploy ke Cloudflare | **Belum**. Yang sudah selesai baru uji lokal di workerd |

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

### Masalah saat menyiapkan Cloudflare Workers (OpenNext), 2026-10-05

Semuanya sudah teratasi. Tabel ini berisi temuan nyata dari menjalankan preview OpenNext di workerd lokal.

| Gejala | Penyebab | Solusi |
|---|---|---|
| `/api/health` balas 503, log Prisma: `could not locate the Query Engine for runtime "debian-openssl-1.1.x". This happened because Prisma Client was generated for "debian-openssl-3.0.x"` | Prisma memakai query engine native `.node` (16,7 MB). Binary native mustahil dimuat di workerd | Tambah `engineType = "client"` di blok generator `schema.prisma`, lalu `npx prisma generate`. Prisma lalu memakai WASM query compiler |
| `/api/health` balas 503, log Prisma: `no such file or directory, readAll '/bundle/node_modules/.prisma/client/query_compiler_bg.wasm'` | Prisma sudah mau pakai WASM tapi memuat file `.wasm` lewat `fs.readFileSync`. Workers tidak punya filesystem sungguhan | `output: "standalone"` di `next.config.ts`. Setelah itu OpenNext membundel file wasm sebagai modul, bukan file mentah |
| `next build` keluar `Segmentation fault (core dumped)` di tahap "Running TypeScript" | `serverExternalPackages` menunjuk ke `.prisma/client` yang berisi `.node` 16,7 MB. Turbopack ikut memuat native binding dan crash | Tetap dipakai, tapi pastikan `output: "standalone"` juga ada. Setelah `output: "standalone"` ditambahkan, Turbopack tidak lagi crash. Build dengan `--webpack` juga berhasil, tapi tidak wajib |
| `npx opennextjs-cloudflare build --skipNextBuild` gagal: `ENOENT ... .next/standalone/.next/server/pages-manifest.json` | `output: "standalone"` belum diset, jadi `.next/standalone` tidak pernah dibuat | Set `output: "standalone"` di `next.config.ts` |
| Rute diagnosti `/api/_probe` selalu 404 dan tidak muncul di bundle | Next.js memperlakukan folder berawalan `_` sebagai private folder dan mengecualikannya dari routing | Jangan pakai prefiks `_` untuk route. Nama yang dipakai di sesi ini: `src/app/api/zzprobe/route.ts` (sudah dihapus) |
| `npx opennextjs-cloudflare preview` tidak jalan karena env tidak terbaca | Preview memakai workerd lokal yang membaca `.dev.vars`, bukan `.env` | Buat `.dev.vars` berisi `DATABASE_URL` (pooled) dan `SESSION_SECRET`. Sudah ter-ignore git |
| `prisma validate` memberi warning `Preview feature "driverAdapters" is deprecated` | Di Prisma 6.19.3 driver adapter sudah GA, tidak perlu preview feature lagi | Hapus `previewFeatures` dari blok generator. Dokumentasi OpenNext masih menyebutnya, jadi halaman itu belum sinkron |

### Hasil uji runtime Workers lokal (port 8787)

Semua di bawah ini dijalankan lewat `npx opennextjs-cloudflare preview` (workerd lokal), bukan `next dev`:

| Yang diuji | Hasil |
|---|---|
| `GET /api/health` | `200` `{"ok":true}` |
| `POST /api/auth/login` | `200`, cookie sesi terbit, sekitar 120-160 ms |
| `GET /api/master/pemilik`, `model?semua=1`, `penjahit`, `warna` | Semua `200` |
| `GET /api/master/ngawur` | `404` `{"error":"Jenis data tidak dikenal."}` |
| `GET /api/master/pemilik` tanpa cookie | `401` `{"error":"Belum login."}` |
| `GET /api/transaksi?limit=5` dan filter `jenis` | `200` |
| `GET /api/sisa` | `200`, perhitungan benar (sisa negatif + `lebih: true`) |
| `GET /api/sisa?penjahitId=abc` | `400` `{"error":"Parameter penjahitId harus angka bulat."}` |
| `POST /api/auth/logout` lalu akses lagi | `200` lalu `401` |

### PBKDF2 di Workers: 210.000 iterasi aman

Dulu ada kekhawatiran bahwa Workers membatasi PBKDF2 maksimal 100.000 iterasi. **Tidak terbukti benar.** Diuji langsung lewat route yang hanya memanggil `crypto.subtle.deriveBits`, tiga kali masing-masing:

| Iterasi | Run 1 | Run 2 | Run 3 |
|---|---|---|---|
| 210.000 | 29 ms | 27 ms | 28 ms |
| 100.000 | 19 ms | 14 ms | 13 ms |

Keduanya berhasil, tidak ada error dan tidak mendekati batas CPU. Rasio ~2:1 sesuai proporsional. Kesimpulan: **210.000 iterasi tidak perlu diturunkan**, `src/lib/auth-password.ts` tidak diubah, dan tidak ada hash yang perlu dibuat ulang.

Login end-to-end (hash + verify) di workerd juga berhasil pada iterasi 210.000, sekitar 120-160 ms per request.

### Uji pembalik: config yang ternyata tidak perlu

Tiga konfigurasi ini sempat dicoba, lalu dicabut dan dites ulang. Semua tetap `200`, jadi tidak diperlukan:

| Config | Hasil setelah dicabut |
|---|---|
| `compatibility_flags: ["nodejs_compat"]` di `wrangler.jsonc` | `/api/health` 200, login 200, transaksi 200, sisa 200. Tapi tetap dipasang karena dokumentasi menyatakan wajib, lihat §11 |
| `previewFeatures = ["driverAdapters"]` | Deprecated di 6.19.3 (lihat tabel di atas) |
| Env var `PRISMA_CLIENT_FORCE_WASM=1` di `.dev.vars` | `/api/health` 200, login 200, transaksi 200, sisa 200 |

Satu-satunya tambahan yang benar-benar wajib adalah `engineType = "client"`, `output: "standalone"`, dan `serverExternalPackages`.

### Urutan kerja yang benar saat prepare Workers

```
rm -rf .next .open-next node_modules/.prisma
npx prisma generate
npm run preview
```

`prisma generate` harus dijalankan ulang setiap kali `schema.prisma` berubah, karena OpenNext menyalin `node_modules/.prisma/client` apa adanya ke dalam output build.

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

- Penggunaan koneksi pooled untuk runtime di **Workers produksi**. Sudah terbukti jalan di workerd lokal (`npm run preview`), tapi belum dicoba di Workers sungguhan yang deploy ke internet.
- Cara login Wrangler dengan API token dari lingkungan remote tanpa browser.
- Detail variabel lingkungan dan perintah build di Workers Builds untuk adapter OpenNext, kalau nanti pakai auto-deploy dari GitHub.
- Batas ukuran worker. Dokumentasi Prisma menyebut free plan punya batas 3 MB. Perlu cek ukuran bundle setelah `opennextjs-cloudflare build` kalau akan deploy di plan gratis.
- Kematangan dan kompatibilitas **vinext** dibanding OpenNext.
- Syarat pemakaian komersial tier gratis Neon dan Cloudflare secara spesifik (hanya dibaca dari ulasan pihak ketiga, bukan syarat resmi).
- Batas 2 akun. Kalau nanti butuh lebih banyak, `prisma/schema.prisma` dan halaman login perlu diubah.

Pola `getDb()` yang membuat Prisma client baru tiap pemanggilan **sudah** terbukti jalan di Codespaces (Node) maupun di workerd lokal (Workers runtime), keduanya dicek 2026-10-05.

## 17. Checklist deploy pertama ke Cloudflare

Belum pernah dijalankan. Semua di bawah hasil baca dokumentasi atau dry run lokal, bukan pengalaman deploy nyata.

### Sebelum mulai

- [ ] Branch sudah di-merge ke `main` (Workers Builds menunggu branch produksi)
- [ ] `npx wrangler deploy --dry-run` sukses dan ukuran gzip masih di bawah batas plan
- [ ] Build dan Deploy command sudah diisi di dashboard

### Setting di dashboard Cloudflare

| Field | Nilai | Catatan |
|---|---|---|
| **Build command** | `npm run deploy` | Wajib diisi. Kalau dikosongkan, Cloudflare hanya jalan `next build`, itu tidak menghasilkan `.open-next/` dan deploy akan gagal |
| **Deploy command** | `npx wrangler deploy` (default) | Boleh dibiarkan default. Tapi `npm run deploy` juga jalan karena `opennextjs-cloudflare deploy` saja sebenarnya sudah cukup |

**Penting soal dua command itu**: script `deploy` di `package.json` adalah `opennextjs-cloudflare build && opennextjs-cloudflare deploy`. Kalau Build command diisi `npm run deploy` **dan** Deploy command diisi `npm run deploy`, build akan jalan dua kali. Setelah deploy pertama, cek di log Workers Builds apakah build terulang. Kalau iya, ganti Build command jadi `npx opennextjs-cloudflare build` saja, atau kosongkan dan andalkan Deploy command.

### Secret runtime

Tempatkan di **Settings → Variables and Secrets**, **BUKAN** "Build variables and secrets" (yang itu hanya tersedia saat build dan tidak sampai ke runtime).

| Nama | Isi | Catatan |
|---|---|---|
| `DATABASE_URL` | Connection string Neon **pooled**, hostname ada `-pooler` | Jangan pakai yang direct. Direct dipakai untuk migrasi, bukan runtime |
| `SESSION_SECRET` | `openssl rand -hex 32`, nilai **baru khusus produksi** | Jangan pakai nilai yang sama dengan Codespaces. Kalau berubah, semua sesi lama jadi tidak valid |

Tidak perlu `DIRECT_URL`, `SEED_USER_USERNAME`, atau `SEED_USER_PASSWORD` di Cloudflare. Migrate dan seed jalan di Codespaces, bukan di Worker.

### Tes setelah deploy

```
curl https://<nama-worker>.workers.dev/api/health
```

Harus balas `{"ok":true}`. Kalau 503, cek log Workers, kemungkinan besar `prisma generate` belum jalan dengan `engineType = "client"` aktif (lihat §11).

Setelah itu:

1. **Login** di browser: buka `https://<nama-worker>.workers.dev/login`, masukkan akun yang ada. Kalau gagal, cek `SESSION_SECRET` sudah terisi.
2. **Smoke test** dari Codespaces, arahkan ke alamat worker:

```
SMOKE_USER=<akun> SMOKE_PASS=<password> ./scripts/smoke-test.sh https://<nama-worker>.workers.dev
```

Data uji berawalan `TES-` tetap dibersihkan otomatis oleh trap di skrip, sama seperti saat tes lokal.

### Risiko yang belum terbukti

Dua hal ini belum ada datanya, jadi belum bisa dijamin akan berhasil di produksi:

| Risiko | Yang diketahui | Kenapa belum terbukti |
|---|---|---|
| **Batas CPU di plan gratis** | Login di lokal memakai sekitar 28 ms per hash PBKDF2 (210.000 iterasi), seluruh request login sekitar 120-160 ms | Plan gratis punya batas CPU per request yang lebih ketat dari worker lokal. Kalau login gagal di produksi, gejalanya biasanya "Worker exceeded resource limits". Mitigasi: turunkan `PBKDF2_ITERASI` di `src/lib/auth-password.ts`, lalu jalankan `npm run ganti-password` untuk membuat ulang hash. Jumlah iterasi tersimpan di dalam string hash, jadi hash lama tetap bisa dibaca |
| **Batas ukuran bundle** | `wrangler deploy --dry-run` terakhir: Total Upload 9.141 KiB, gzip **2.209 KiB** | Dokumentasi menyebut free plan punya batas sekitar 3 MB. Sekarang pakai sekitar 72% dari batas, jadi masih muat tapi ruangnya tipis. Kalau nanti bundle membesar (tambah dependency), bisa kena batas |

Perintah untuk cek ukuran kapan saja:

```
npx wrangler deploy --dry-run
```

Baca baris `Total Upload` dan `gzip`. Yang relevan adalah angka **gzip**, karena itu yang dihitung terhadap batas upload.
