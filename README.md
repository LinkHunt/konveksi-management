# Konveksi Management (APK)

Aplikasi Android **offline** untuk usaha jasa jahit (konveksi): mencatat bahan yang dibawa penjahit, setoran hasil jahitan, dan sisa yang belum disetor — per **pemilik → model → warna → ukuran**.

Semua data disimpan **lokal di HP** (SQLite di dalam aplikasi). Tidak ada server, tidak perlu internet, tidak ada akun yang harus login.

## Fitur

- **Hasil potong** — catat hasil potongan bahan per model + warna + ukuran.
- **Setoran** — catat setoran per penjahit; riwayat setoran lengkap.
- **Belum di setorkan (kurang)** — sisa otomatis per ukuran, filter "sembunyikan selesai".
- **Master data** — pemilik, model, warna, ukuran, penjahit — bisa ditambah/diedit dari aplikasi.
- **Ekspor foto tabel** — setiap daftar bisa diekspor jadi PNG rapi (judul, tabel, kaki catatan), otomatis disimpan ke `Documents/Gambar/` + share sheet. Nama file unik per ekspor (cap waktu) dan anti-timpa arsip lama.
- **Backup** — ekspor/impor snapshot database.

## Yang dipakai aplikasi ini

| Lapisan | Teknologi |
|---|---|
| UI | React 19 + TypeScript + Tailwind CSS 4 |
| Build | Vite 7 (SPA) |
| Navigasi | react-router-dom 7 |
| Database | [sql.js](https://sql.js.org/) — SQLite in-memory (WASM), persist ke file `konveksi.db` lewat filesystem |
| Validasi | zod 4 |
| Native shell | Capacitor 8 (`@capacitor/filesystem`, `@capacitor/share`) |
| Platform | Android (WebView), appId `id.konveksi.management` |

Tidak ada backend. Database SQLite dienkripsi? Tidak — file biasa di storage aplikasi; backup lewat fitur ekspor di app.

## Download

Ambil APK terbaru dari halaman **[Releases](../../releases)**.

Catatan update:
- APK di-release **di-sign dengan keystore yang sama** sejak v1.1 → bisa **update in-place** tanpa uninstall (data aman).
- APK debug build / build dari mesin lain **tidak bisa** menimpa app release (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`). Kalau signature beda, uninstall = data SQLite di app ikut hilang — backup dulu lewat fitur backup.

## Bangun dari source

Prasyarat: Node 20+, JDK 21, Android SDK (build-tools + platform).

```bash
npm install
npm run typecheck
npm run build
npx cap sync android
cd android && ./gradlew assembleRelease
```

Sign (wajib pakai keystore yang sama agar bisa update):

```bash
apksigner sign \
  --ks konveksi-release.keystore \
  --ks-pass env:PW \
  --out app-release-signed.apk app-release-unsigned.apk
```

(`export PW=...` dulu — `env:PW` baca dari environment variable.)

## Struktur singkat

```
src/
  app/(app)/     # halaman: hasil potong, setoran, kurang, master
  components/    # UI + TombolEkspor
  lib/           # sql.js wrapper, ekspor PNG, tanggal
android/         # proyek Capacitor Android (tidak di-commit build output)
capacitor.config.ts
```

## Lisensi

Private / belum dilisensikan.
