# Kontrak API Management Konveksi

Dokumen ini ditulis dari kode yang benar-benar jalan dan diverifikasi lewat
`scripts/smoke-test.sh` (91 pemeriksaan). Semua contoh respons di bawah adalah
hasil panggilan sungguhan ke server dev, bukan karangan.

Base URL pengembangan: `http://localhost:3000`

---

## Aturan umum

### Format respons

Sukses:

```json
{ "data": { }, "paging": { } }
```

Gagal:

```json
{ "error": "pesan singkat bahasa Indonesia", "detail": { } }
```

`detail` hanya ada kalau ada informasi tambahan. Halaman tidak boleh pernah
menampilkan isi `detail` mentah untuk pesan server; `error` sudah aman
ditampilkan langsung ke user.

### Status yang dipakai

| Status | Arti | Contoh `error` |
|---|---|---|
| 200 | Berhasil | - |
| 400 | Permintaan tidak valid | pesan spesifik field |
| 401 | Belum login, atau login gagal | `Belum login.` |
| 403 | Asal request tidak cocok | `Permintaan ditolak karena asal tidak cocok.` |
| 404 | Data tidak ada, atau path tidak dikenal | `Jenis data tidak dikenal.` |
| 409 | Konflik: nama duplikat atau master masih dipakai | pesan spesifik |
| 503 | Database tidak terjangkau, hanya untuk health check | - |
| 500 | Kesalahan server | `Terjadi kesalahan di server.` |

500 **tidak pernah** mengirim pesan asli. Detail asli hanya ditulis ke log
server.

### Format error validasi

Kalau payload gagal divalidasi:

```json
{
  "error": "Data yang dikirim tidak valid.",
  "detail": {
    "issues": [
      { "field": "penjahitId", "pesan": "Penjahit wajib dipilih." }
    ]
  }
}
```

`field` berisi path field yang salah. Kalau error-nya di level objek tanpa
field, isinya `"(akar)"`.

### Sesi

Login mengembalikan cookie:

```
Set-Cookie: konveksi_session=<token>; Path=/; Max-Age=604800; HttpOnly; SameSite=lax
```

Token berisi `uid`, `username`, dan `exp`, ditandatangani HMAC-SHA256, berlaku 7
hari. Header `Secure` otomatis ditambahkan saat `NODE_ENV=production`.

Frontend **hanya** perlu menyimpan cookie; browser yang mengirimnya otomatis.
Jangan pernah tries menyimpan token di `localStorage`.

Request yang mengubah data, yaitu POST, PUT, PATCH, dan DELETE, harus punya
header `Origin` yang sama dengan host aplikasi, kalau tidak dibalas **403**.
Browser mengirim `Origin` sendiri, jadi tidak perlu pengaturan manual. Request
tanpa header `Origin` sama sekali, misalnya curl atau skrip CLI, tetap diizinkan
supaya smoke test bisa jalan.

### Master data

Empat jenis master, dipanggil lewat path yang sama:

| Path | Isi |
|---|---|
| `/api/master/pemilik` | Pemilik baju |
| `/api/master/model` | Model baju, wajib punya `pemilikId` |
| `/api/master/warna` | Warna |
| `/api/master/penjahit` | Penjahit |

Path lain di segment itu membalas **404** `Jenis data tidak dikenal.`

**Tidak ada** endpoint DELETE untuk master. Untuk "menghapus" master, ubah
`aktif` jadi `false` lewat PATCH supaya riwayat transaksi lama tetap utuh.

---

## Daftar ukuran

Hanya sembilan nilai ini yang valid, dan API **selalu** memakai label ini:

```
XS, S, M, L, XL, 2L, 3L, 5L, 8L
```

Perhatikan `2L`, bukan `L2`. Nama enum internal di kode Prisma memang `L2`,
tapi itu tidak boleh bocor ke klien. Postgres menyimpan label asli `2L`.

Ukuran dinormalisasi ke huruf besar dan dipangkas spasi, jadi `" m "` tetap
diterima. Nilai di luar daftar tersebut ditolak dengan 400.

---

## Endpoint

### `GET /api/health`

Pemeriksaan kesehatan publik, **tidak butuh login**. Hanya mengembalikan
`{ ok: true }` atau `{ ok: false }` supaya tidak membocorkan jumlah data.

```json
{ "ok": true }
```

Kalau koneksi database gagal: `{ "ok": false }` dengan status **503**.

---

### `POST /api/auth/login`

Body:

```json
{ "username": "akun-anda", "password": "rahasia-anda" }
```

Sukses (200), dengan `Set-Cookie`:

```json
{ "user": { "id": 1, "username": "akun-anda" } }
```

Gagal login **selalu** 401 dengan pesan yang sama, baik password salah maupun
username tidak terdaftar, supaya tidak bisa dipakai menebak username mana yang
ada.

| Kondisi | Status | `error` |
|---|---|---|
| Password salah atau username tidak ada | 401 | `Username atau password salah.` |
| Username atau password kosong | 400 | `Username dan password wajib diisi.` |
| Body bukan JSON valid | 400 | `Body harus berupa JSON yang valid.` |

---

### `POST /api/auth/logout`

Menghapus cookie session. Tidak butuh login: logout dari sesi mana pun tetap 200.

```json
{ "ok": true }
```

---

### `GET /api/master/{entity}`

Daftar master. Butuh login.

Query:

| Parameter | Nilai | Bawaan | Arti |
|---|---|---|---|
| `semua` | `1` | - | Kalau `1`, ikut sertakan master nonaktif. Tanpa ini hanya master aktif. |

Urutan selalu `nama` ascending.

```bash
curl -b cookies.txt "http://localhost:3000/api/master/pemilik"
curl -b cookies.txt "http://localhost:3000/api/master/model?semua=1"
```

`pemilik`, `warna`, `penjahit` mengembalikan bentuk sederhana:

```json
{
  "data": [
    { "id": 8, "nama": "TES-Doc-Pemilik", "aktif": true }
  ]
}
```

`model` juga menyertakan data pemiliknya:

```json
{
  "data": [
    {
      "id": 9,
      "nama": "TES-Doc-Model",
      "aktif": true,
      "pemilikId": 8,
      "pemilik": { "id": 8, "nama": "TES-Doc-Pemilik" }
    }
  ]
}
```

Error: 401 `Belum login.`, 404 `Jenis data tidak dikenal.`

---

### `POST /api/master/{entity}`

Buat master baru.

Body untuk `pemilik`, `warna`, `penjahit`:

```json
{ "nama": "TES-Doc-Warna", "aktif": true }
```

Body untuk `model`, dengan `pemilikId` wajib:

```json
{ "nama": "TES-Doc-Model", "pemilikId": 8 }
```

`aktif` opsional, bawaan `true`.

Sukses (200) untuk pemilik, warna, penjahit:

```json
{ "data": { "id": 13, "nama": "TES-Doc-Warna", "aktif": true } }
```

Sukses (200) untuk model:

```json
{
  "data": {
    "id": 9,
    "nama": "TES-Doc-Model",
    "aktif": true,
    "pemilikId": 8,
    "pemilik": { "id": 8, "nama": "TES-Doc-Pemilik" }
  }
}
```

| Kondisi | Status | `error` |
|---|---|---|
| `nama` kosong atau cuma spasi | 400 | `Nama wajib diisi.` |
| `nama` lebih dari 120 karakter | 400 | `Nama maksimal 120 karakter.` |
| Nama sudah ada, huruf besar kecil diabaikan | 409 | `Warna "TES-Doc-Warna" sudah ada.` |
| Model tanpa `pemilikId` | 400 | `Data yang dikirim tidak valid.` dengan `issues` berisi `field: "pemilikId"` dan `pesan: "Pemilik wajib dipilih."` |
| `pemilikId` tidak ada di database | 400 | `Pemilik tidak ditemukan.` |
| `pemilikId` menunjuk pemilik nonaktif | 400 | `Pemilik yang dipilih sudah nonaktif.` |

Nama dianggap duplikat secara insensitive huruf: `Merah` dan `MERAH` dianggap
sama. Untuk `model`, duplikat dicek per kombinasi pemilik + nama, jadi model
`Kemeja` milik dua pemilik berbeda tetap bisa dibuat.

---

### `GET /api/master/{entity}/{id}`

Detail satu master. Butuh login.

```json
{ "data": { "id": 8, "nama": "TES-Doc-Pemilik", "aktif": true } }
```

Error: 401 `Belum login.`, 404 `Jenis data tidak dikenal.` atau
`Model baju tidak ditemukan.`, 400 `Id tidak valid.` kalau segment id bukan
angka bulat positif.

---

### `PATCH /api/master/{entity}/{id}`

Ubah nama dan/atau status aktif. Butuh login.

Body:

```json
{ "nama": "Nama Baru", "aktif": false }
```

Kedua field opsional. Yang tidak dikirim tidak berubah.

Sukses (200) memakai bentuk yang sama seperti POST.

Dua perilaku yang perlu diketahui form:

1. **Menonaktifkan master yang masih dipakai transaksi ditolak** dengan 409,
   karena itu akan mengubah laporan sisa tanpa jejak:

   ```json
   {
     "error": "Model baju masih dipakai transaksi yang sudah tercatat.",
     "detail": { "jumlahTransaksi": 2 }
   }
   ```

   Untuk `pemilik`, pesannya: `Pemilik masih dipakai model baju yang dipakai transaksi.`

2. **Mengganti `pemilikId` model** lewat PATCH harus menunjuk pemilik yang ada
   dan aktif, sama seperti saat membuat model.

---

### `GET /api/transaksi`

Daftar transaksi, terbaru lebih dulu: tanggal turun, lalu id turun. Butuh login.

Query:

| Parameter | Tipe | Bawaan | Keterangan |
|---|---|---|---|
| `page` | integer min 1 | 1 | Nomor halaman |
| `limit` | integer 1 sampai 100 | 20 | Jumlah baris per halaman, maksimal 100 |
| `jenis` | `SETORAN` atau `BAHAN_KELUAR` | - | Filter jenis |
| `penjahitId` | integer min 1 | - | Filter penjahit |
| `modelId` | integer min 1 | - | Filter model |
| `pemilikId` | integer min 1 | - | Filter pemilik, lewat model |
| `tanggalDari` | `YYYY-MM-DD` | - | Batas bawah, inklusif |
| `tanggalSampai` | `YYYY-MM-DD` | - | Batas atas, inklusif |

Kedua batas tanggal inklusif: transaksi dengan tanggal sama dengan
`tanggalDari` maupun `tanggalSampai` tetap ikut.

```bash
curl -b cookies.txt "http://localhost:3000/api/transaksi?jenis=BAHAN_KELUAR&limit=10"
curl -b cookies.txt "http://localhost:3000/api/transaksi?tanggalDari=2026-10-01&tanggalSampai=2026-10-31"
```

Respons:

```json
{
  "data": [
    {
      "id": 27,
      "tanggal": "2026-10-01",
      "jenis": "BAHAN_KELUAR",
      "catatan": "Contoh",
      "penjahit": { "id": 9, "nama": "TES-Doc-Penjahit" },
      "pemilik": { "id": 8, "nama": "TES-Doc-Pemilik" },
      "model": { "id": 9, "nama": "TES-Doc-Model" },
      "warna": { "id": 13, "nama": "TES-Doc-Warna" },
      "items": [
        { "ukuran": "L", "jumlah": 10 },
        { "ukuran": "2L", "jumlah": 5 }
      ],
      "totalPcs": 15
    }
  ],
  "paging": { "page": 1, "limit": 2, "total": 1, "totalHalaman": 1 }
}
```

`totalPcs` adalah jumlah seluruh item, sudah dihitung server. Tidak perlu
dihitung lagi di frontend.

| Kondisi | Status | `error` |
|---|---|---|
| Belum login | 401 | `Belum login.` |
| `limit` di atas 100 | 400 | `Parameter limit maksimal 100.` |
| `limit` atau `page` bukan angka bulat | 400 | `Parameter limit harus angka bulat.` |
| `jenis` tidak dikenal | 400 | `jenis harus SETORAN atau BAHAN_KELUAR.` |
| Tanggal format salah | 400 | `tanggalDari tidak valid. Gunakan format YYYY-MM-DD.` |

---

### `POST /api/transaksi`

Buat transaksi beserta itemnya.

```json
{
  "tanggal": "2026-10-01",
  "jenis": "BAHAN_KELUAR",
  "penjahitId": 9,
  "modelId": 9,
  "warnaId": 13,
  "catatan": "Contoh",
  "items": [
    { "ukuran": "L", "jumlah": 10 },
    { "ukuran": "2L", "jumlah": 5 }
  ]
}
```

`catatan` opsional, maksimal 500 karakter. Semua field lain wajib.

Sukses (200), bentuknya sama seperti entri di `GET /api/transaksi`.

Perilaku item yang perlu diketahui form:

- Item dengan `jumlah: 0` atau negatif **dibuang diam-diam**, bukan error.
  Kirim `{ "ukuran": "S", "jumlah": 0 }` bersama item lain, `S` tidak muncul
  di respons.
- Kalau **semua** item kena dibuang, barulah jadi error 400
  `Minimal satu baris ukuran dengan jumlah lebih dari 0.`
- Ukuran yang sama **tidak boleh muncul lebih dari sekali** dalam satu
  transaksi. Gabungkan manual di frontend: dua baris `L` harus jadi satu baris
  dengan jumlah dijumlahkan.
- Maksimal 20 baris ukuran per transaksi.
- `items` otomatis diurutkan dari ukuran terkecil ke terbesar, tidak mengikuti
  urutan kirim.

| Kondisi | Status | `error` |
|---|---|---|
| Semua item jumlah 0 | 400 | `Minimal satu baris ukuran dengan jumlah lebih dari 0.` |
| Ukuran dobel | 400 | `Ukuran L muncul lebih dari sekali.` |
| Ukuran tidak dikenal | 400 | `Ukuran tidak dikenal: 9L. Gunakan: XS, S, M, L, XL, 2L, 3L, 5L, 8L.` |
| Tanggal tidak ada di kalender | 400 | `Tanggal tidak valid. Gunakan format YYYY-MM-DD.` |
| Tanggal format salah | 400 | `Tanggal harus format YYYY-MM-DD.` |
| `jenis` tidak dikenal | 400 | `Data yang dikirim tidak valid.` dengan `issues` `field: "jenis"` |
| Master tidak ditemukan | 400 | `Penjahit tidak ditemukan.` / `Model baju tidak ditemukan.` / `Warna tidak ditemukan.` |
| Master yang dipilih nonaktif | 400 | `Penjahit yang dipilih sudah nonaktif.` / `Model baju yang dipilih sudah nonaktif.` / `Warna yang dipilih sudah nonaktif.` |
| Pemilik model nonaktif | 400 | `Pemilik dari model yang dipilih sudah nonaktif.` |
| `catatan` lebih dari 500 karakter | 400 | `Catatan maksimal 500 karakter.` |
| Lebih dari 20 item | 400 | `Maksimal 20 baris ukuran per transaksi.` |

Header transaksi dan itemnya disimpan dalam satu operasi atomik, jadi tidak
pernah ada transaksi tersimpan dengan item tidak lengkap.

---

### `GET /api/transaksi/{id}`

Detail satu transaksi. Bentuknya sama seperti entri di list.

Error: 401 `Belum login.`, 404 `Transaksi tidak ditemukan.`, 400
`Id tidak valid.`

---

### `PUT /api/transaksi/{id}`

Ganti isi transaksi. Seluruh item lama **dihapus dan diganti** oleh item baru,
bukan digabung. Body-nya identik dengan `POST /api/transaksi`.

Perilaku penting untuk form koreksi:

- Kalau PUT mengubah `penjahitId`, `modelId`, atau `warnaId`, master baru harus
  aktif.
- Kalau **tidak** mengubah master-nya, master nonaktif yang sudah dipakai
  sebelumnya **tetap boleh** dipakai. Ini supaya transaksi lama bisa dikoreksi
  walaupun master-nya sudah dinonaktifkan.

Error sama seperti POST, ditambah 404 `Transaksi tidak ditemukan.` kalau id
tidak ada.

---

### `DELETE /api/transaksi/{id}`

Hapus transaksi beserta itemnya. Pakai ini untuk koreksi salah input.

```json
{ "ok": true, "id": 27 }
```

Item terhapus otomatis. Error: 401 `Belum login.`, 404
`Transaksi tidak ditemukan.`

---

## `GET /api/sisa`

Sisa bahan per ukuran: `sisa = bahan keluar - setoran`, dihitung langsung di
database dan **tidak disimpan** di tabel mana pun.

Dihitung dan dikelompokkan per penjahit, pemilik, model, warna, dan ukuran.

Query:

| Parameter | Tipe | Bawaan | Keterangan |
|---|---|---|---|
| `penjahitId` | integer min 1 | - | Filter penjahit |
| `pemilikId` | integer min 1 | - | Filter pemilik |
| `modelId` | integer min 1 | - | Filter model |
| `warnaId` | integer min 1 | - | Filter warna |
| `sembunyikanNol` | `0` untuk menampilkan | disembunyikan | Baris sisa tepat 0 disembunyikan secara bawaan |

Contoh nyata untuk `penjahitId=9` dan `sembunyikanNol=0`:

```json
{
  "data": [
    {
      "penjahit": { "id": 9, "nama": "TES-Doc-Penjahit" },
      "baris": [
        {
          "penjahitId": 9,
          "penjahitNama": "TES-Doc-Penjahit",
          "pemilikId": 8,
          "pemilikNama": "TES-Doc-Pemilik",
          "modelId": 9,
          "modelNama": "TES-Doc-Model",
          "warnaId": 13,
          "warnaNama": "TES-Doc-Warna",
          "ukuran": "M",
          "bahanKeluar": 0,
          "setoran": 2,
          "sisa": -2,
          "lebih": true
        },
        {
          "penjahitId": 9,
          "penjahitNama": "TES-Doc-Penjahit",
          "pemilikId": 8,
          "pemilikNama": "TES-Doc-Pemilik",
          "modelId": 9,
          "modelNama": "TES-Doc-Model",
          "warnaId": 13,
          "warnaNama": "TES-Doc-Warna",
          "ukuran": "L",
          "bahanKeluar": 10,
          "setoran": 4,
          "sisa": 6,
          "lebih": false
        },
        {
          "penjahitId": 9,
          "penjahitNama": "TES-Doc-Penjahit",
          "pemilikId": 8,
          "pemilikNama": "TES-Doc-Pemilik",
          "modelId": 9,
          "modelNama": "TES-Doc-Model",
          "warnaId": 13,
          "warnaNama": "TES-Doc-Warna",
          "ukuran": "2L",
          "bahanKeluar": 5,
          "setoran": 0,
          "sisa": 5,
          "lebih": false
        }
      ],
      "totalSisa": 9,
      "totalBahanKeluar": 15,
      "totalSetoran": 6,
      "adaLebih": true
    }
  ],
  "ringkasan": {
    "jumlahPenjahit": 1,
    "totalBahanKeluar": 15,
    "totalSetoran": 6,
    "totalSisa": 9,
    "adaLebih": true
  }
}
```

### Aturan sisa yang perlu dijaga di frontend

1. **Sisa negatif tidak dipotong ke 0.** Nilai minus dikembalikan apa adanya,
   dan barisnya dapat flag `lebih: true`. Baris dengan `lebih: true` berarti
   ada lebih banyak setoran daripada bahan keluar, kemungkinan salah input.
   `adaLebih` di level penjahit dan di `ringkasan` menandai hal yang sama.

2. **Baris sisa tepat 0 disembunyikan secara bawaan.** Kirim
   `sembunyikanNol=0` untuk menampilkannya juga.

3. **Total mengikuti baris yang terlihat.** `totalSisa`, `totalBahanKeluar`, dan
   `totalSetoran` dihitung **setelah** baris sisa 0 difilter, jadi angkanya
   selalu cocok dengan yang terlihat di layar. Kalau user mengaktifkan
   `sembunyikanNol=0`, angka total ikut naik mengikuti baris yang baru
   dimunculkan. Ini disengaja supaya total dengan baris yang tampil selalu
   konsisten.

4. **Baris hanya muncul kalau ada transaksi.** Ukuran yang tidak pernah ada di
   transaksi mana pun tidak akan muncul di respons.

5. **Urutan baris**: nama penjahit, lalu pemilik, lalu model, lalu warna, lalu
   ukuran dari kecil ke besar. Array `data` diurutkan per nama penjahit.

6. Kalau filter tidak menghasilkan apa pun, `data` adalah array kosong dan
   `ringkasan` tetap ada dengan semua total 0 dan `adaLebih: false`.

| Kondisi | Status | `error` |
|---|---|---|
| Belum login | 401 | `Belum login.` |
| Parameter filter bukan angka bulat | 400 | `Parameter penjahitId harus angka bulat.` |
| Nilai filter 0 atau negatif | 400 | `Parameter penjahitId minimal 1.` |

---

## Menjalankan smoke test

Server dev harus sudah jalan, lalu:

```bash
SMOKE_USER=<akun> SMOKE_PASS=<password> ./scripts/smoke-test.sh http://localhost:3000
```

91 pemeriksaan, semuanya memakai data berawalan `TES-` yang dihapus lagi di
akhir. Kredensial hanya dibaca dari environment, tidak pernah ditulis di file.
