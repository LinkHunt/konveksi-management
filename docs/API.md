# Kontrak API Management Konveksi

Dokumen ini ditulis dari kode yang benar-benar jalan dan diverifikasi lewat
`scripts/smoke-test.sh` (69 pemeriksaan). Semua contoh respons di bawah adalah
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
`aktif` jadi `false` lewat PATCH supaya catatan lama (hasil potong, setoran,
transaksi) tetap utuh.

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

1. **Menonaktifkan master yang masih dipakai ditolak** dengan 409, karena itu
   akan mengubah laporan tanpa jejak. "Dipakai" = hasil potong, setoran, atau
   transaksi lama yang masih merujuk master itu:

   ```json
   {
     "error": "Model baju masih dipakai hasil potong atau setoran.",
     "detail": { "jumlahTransaksi": 2 }
   }
   ```

   `detail.jumlahTransaksi` adalah gabungan transaksi + hasil potong + item
   setoran yang merujuk master itu. Untuk `pemilik`, pesannya: `Pemilik masih
   dipakai model baju yang dipakai hasil potong atau setoran.`
   Untuk `penjahit`, yang dicek hanya transaksi lama (domain baru tidak
   mengikutkannya).

2. **Mengganti `pemilikId` model** lewat PATCH harus menunjuk pemilik yang ada
   dan aktif, sama seperti saat membuat model.

---
### `GET /api/hasil-potong`

Daftar hasil potong, dikelompokkan per model lalu per warna. **Hasil potong
adalah sumber data yang benar** — semua setoran dibatasi dari angka ini. Butuh
login.

Query:

| Parameter | Tipe | Bawaan | Keterangan |
|---|---|---|---|
| `pemilikId` | integer min 1 | - | Filter pemilik |
| `modelId` | integer min 1 | - | Filter model |

```bash
curl -b cookies.txt "http://localhost:3000/api/hasil-potong"
curl -b cookies.txt "http://localhost:3000/api/hasil-potong?modelId=9"
```

Respons:

```json
{
  "data": [
    {
      "modelId": 9,
      "modelNama": "TES-Doc-Model",
      "pemilikId": 8,
      "pemilikNama": "TES-Doc-Pemilik",
      "total": 15,
      "warna": [
        {
          "warnaId": 13,
          "warnaNama": "TES-Doc-Warna",
          "subtotal": 15,
          "baris": [
            { "id": 1, "warnaId": 13, "warnaNama": "TES-Doc-Warna", "ukuran": "L", "jumlah": 10 },
            { "id": 2, "warnaId": 13, "warnaNama": "TES-Doc-Warna", "ukuran": "2L", "jumlah": 5 }
          ]
        }
      ]
    }
  ]
}
```

`total` = jumlah seluruh baris model itu, `subtotal` = jumlah seluruh baris
satu warna. `id` di tiap baris dipakai sebagai target koreksi/hapus/riwayat.

| Kondisi | Status | `error` |
|---|---|---|
| Belum login | 401 | `Belum login.` |
| `modelId` bukan angka bulat | 400 | `Parameter modelId harus angka bulat.` |

---

### `POST /api/hasil-potong`

Simpan hasil potong untuk satu model, bisa banyak warna sekaligus. Kombinasi
model + warna + ukuran yang **sudah ada ditimpa angkanya** (tercatat di
riwayat), bukan jadi baris dobel.

```json
{
  "modelId": 9,
  "baris": [
    { "warnaId": 13, "ukuran": "L", "jumlah": 10 },
    { "warnaId": 13, "ukuran": "2L", "jumlah": 5 }
  ]
}
```

Perilaku baris:

- `jumlah` wajib angka; yang `<= 0`, bukan integer, atau `NaN` **dibuang
  diam-diam** — tidak pernah tersimpan.
- Kalau **semua** baris kena buang -> 400 `Minimal satu baris warna dan ukuran dengan jumlah lebih dari 0.`
- Kombinasi warna + ukuran yang sama dalam satu request -> 400
  `... muncul lebih dari sekali. Gabungkan jumlahnya jadi satu baris.`
- Maksimal 60 baris; model wajib ada + aktif; setiap warna wajib ada + aktif.

Sukses: `{ "ok": true }`. Semua baris disimpan + riwayat ditulis dalam **satu
transaksi** — tidak ada potongan tercatat tanpa riwayat.

| Kondisi | Status | `error` |
|---|---|---|
| Belum login | 401 | `Belum login.` |
| Model tidak ada | 400 | `Model baju tidak ditemukan.` |
| Model nonaktif | 400 | `Model baju yang dipilih sudah nonaktif.` |
| Warna tidak ada | 400 | `Warna tidak ditemukan: #13.` |
| Warna nonaktif | 400 | `Warna TES-Doc-Warna sudah nonaktif.` |
| Ukuran bukan ukuran sah | 400 | `Ukuran harus salah satu dari: XS, S, M, ...` |
| Duplikat kombinasi dalam request | 400 | `<nama warna> ukuran <ukuran> muncul lebih dari sekali. Gabungkan jumlahnya jadi satu baris.` |
| `baris` kosong / semua jumlah 0 | 400 | `Minimal satu baris warna dan ukuran dengan jumlah lebih dari 0.` |

Model + semua warna dicek di awal: kalau salah satu warna nonaktif, tidak ada
satupun baris yang tersimpan.

---

### `GET /api/hasil-potong/{id}`

Riwayat perubahan satu baris hasil potong, terbaru dulu (id turun). Setiap aksi
`BUAT`/`UBAH`/`HAPUS` tercatat dengan jumlah lama dan baru. **Riwayat tetap ada
setelah baris asal dihapus** (tabel riwayat sengaja tanpa FK ke baris induk).

```json
{
  "data": [
    {
      "id": 12,
      "aksi": "UBAH",
      "modelNama": "TES-Doc-Model",
      "pemilikNama": "TES-Doc-Pemilik",
      "warnaNama": "TES-Doc-Warna",
      "ukuran": "L",
      "jumlahLama": 10,
      "jumlahBaru": 12,
      "waktu": "2026-10-06T04:00:00.000Z"
    }
  ]
}
```

`jumlahLama` null saat `BUAT` (barunya dicatat di `jumlahBaru`), `jumlahBaru`
null saat `HAPUS`. Endpoint **selalu** menjawab 200 dengan array `data` —
mungkin kosong — meski baris asal sudah dihapus (riwayatnya dipecah per id,
bukan per baris yang hidup). Hanya error 401 `Belum login.`

---

### `PUT /api/hasil-potong/{id}`

Koreksi jumlah satu baris hasil potong.

```json
{ "jumlah": 12 }
```

**Batas A11**: jumlah baru tidak boleh turun di bawah total setoran yang sudah
tercatat untuk kombinasi itu; kalau turun, ditolak. Setoran yang diizinkan
minimal sama dengan angka setoran yang sudah ada, jadi data tidak pernah jadi
"kurang lebih dari yang sudah diserahkan".

| Kondisi | Status | `error` |
|---|---|---|
| Belum login | 401 | `Belum login.` |
| Baris tidak ada | 404 | `Hasil potong tidak ditemukan.` |
| Turun di bawah total setoran | 400 | `Jumlah tidak bisa diturunkan ke <x>. Kombinasi ini sudah disetor <y> pcs.` |
| `jumlah` bukan angka bulat / negatif | 400 | `Jumlah harus angka bulat 0 atau lebih.` |

Sukses: `{ "ok": true }`. Perubahan dicatat `UBAH` di riwayat dalam transaksi
yang sama.

---

### `DELETE /api/hasil-potong/{id}`

Hapus satu baris hasil potong. **Batas A11**: diblokir kalau kombinasi itu sudah
punya setoran (`totalSetor > 0`), supaya riwayat setoran tetap konsisten dengan
target yang pernah ada.

```json
{ "ok": true, "id": 12 }
```

| Kondisi | Status | `error` |
|---|---|---|
| Belum login | 401 | `Belum login.` |
| Baris tidak ada | 404 | `Hasil potong tidak ditemukan.` |
| Sudah disetor | 400 | `Hasil potong ini sudah disetor <y> pcs, tidak bisa dihapus.` |

Riwayat baris yang dihapus tetap tersimpan; aksi `HAPUS` ditulis sebelum baris
induk dihapus dalam satu transaksi.

---

### `GET /api/setoran`

Daftar setoran ringkas, terbaru dulu (tanggal turun, lalu id turun). Butuh login.

Query:

| Parameter | Tipe | Bawaan | Keterangan |
|---|---|---|---|
| `tanggal` | `YYYY-MM-DD` | - | Batasi ke satu hari |
| `limit` | integer 1..100 | `50` | Banyak baris |

```bash
curl -b cookies.txt "http://localhost:3000/api/setoran"
curl -b cookies.txt "http://localhost:3000/api/setoran?tanggal=2026-10-06&limit=30"
```

Respons:

```json
{
  "data": [
    {
      "id": 4,
      "tanggal": "2026-10-06",
      "catatan": "Setoran awal",
      "totalPcs": 5,
      "jumlahItem": 2
    }
  ]
}
```

`totalPcs` dihitung server dari seluruh item, `jumlahItem` = baris item.
`catatan` bisa `null`. `tanggal` yang bukan `YYYY-MM-DD` -> 400 `Tanggal harus format YYYY-MM-DD.`

---

### `POST /api/setoran`

Buat setoran. **Setoran tidak boleh melebihi hasil potongan**: untuk tiap
kombinasi model + warna + ukuran, server menghitung

```
diizinkan = jumlah hasil potong (nilai terbaru) - total setoran lain (kecuali setoran yang sedang diedit)
```

dan menolak kalau ada yang melewatinya.

```json
{
  "tanggal": "2026-10-06",
  "catatan": "Setoran awal",
  "items": [
    { "modelId": 9, "warnaId": 13, "ukuran": "L", "jumlah": 5 },
    { "modelId": 9, "warnaId": 13, "ukuran": "2L", "jumlah": 2 }
  ]
}
```

Perilaku item: `jumlah <= 0` atau bukan integer dibuang diam-diam; semua kena
buang -> 400 `Minimal satu baris model, warna, dan ukuran dengan jumlah lebih dari 0.`
Kombinasi yang sama tidak boleh muncul dua kali dalam satu request. Maksimal
120 baris. `catatan` opsional (trim; kosong -> `null`).

Sukses: `{ "ok": true, "id": 4 }`. Header + item disimpan dalam satu transaksi
atomik.

| Kondisi | Status | `error` |
|---|---|---|
| Belum login | 401 | `Belum login.` |
| Melebihi target | 400 | `Setoran melebihi target untuk <model> warna <warna> ukuran <ukuran>: tersisa <s> pcs dari potongan <p>, yang kamu isi <z>.` |
| Tidak ada hasil potongan untuk kombinasi | 400 | `Tidak ada hasil potongan untuk <model> warna <warna> ukuran <ukuran>. Setoran tidak bisa melebihi potongan.` |
| Tanggal tidak valid | 400 | `Tanggal harus format YYYY-MM-DD.` |
| Duplikat kombinasi dalam request | 400 | `Baris <modelId> <warnaId> <ukuran> muncul lebih dari sekali. Gabungkan jumlahnya jadi satu baris.` |

---

### `GET /api/setoran/{id}`

Detail satu setoran lengkap dengan item, dipakai form koreksi dan dialog detail.

```json
{
  "data": {
    "id": 4,
    "tanggal": "2026-10-06",
    "catatan": "Setoran awal",
    "createdAt": "2026-10-06T04:00:00.000Z",
    "updatedAt": "2026-10-06T04:00:00.000Z",
    "totalPcs": 7,
    "items": [
      {
        "modelId": 9,
        "modelNama": "TES-Doc-Model",
        "pemilikNama": "TES-Doc-Pemilik",
        "warnaId": 13,
        "warnaNama": "TES-Doc-Warna",
        "ukuran": "L",
        "jumlah": 5
      }
    ]
  }
}
```

`pemilikNama` ikut dari `ModelBaju`. Item diurutkan model lalu warna. Error:
401 `Belum login.`, 404 `Setoran tidak ditemukan.`

---

### `PUT /api/setoran/{id}`

Ganti seluruh isi setoran. Item lama **dihapus dan diganti** item baru, bukan
digabung. Body identik dengan `POST /api/setoran`.

Setoran yang sedang diedit **dikecualikan** dari hitungan kuota setoran lain,
jadi kalau user menaikkan isi setoran yang sama, sisa target dihitung seolah
item lamanya belum ada. Validasi melebihi-kurang tetap berlaku terhadap item
baru. Sukses menjawab detail yang sudah diganti (bentuk sama dengan `GET
/api/setoran/{id}`).

Error sama seperti POST, ditambah 404 `Setoran tidak ditemukan.` kalau id tidak
ada.

---

### `DELETE /api/setoran/{id}`

Hapus setoran beserta itemnya (ON DELETE CASCADE). Kuota setoran untuk kombinasi
yang disentuh langsung terbebas, jadi angka `kurang` naik kembali otomatis.

```json
{ "ok": true, "id": 4 }
```

Error: 401 `Belum login.`, 404 `Setoran tidak ditemukan.`

---

### `GET /api/kurang`

Hasil potongan dikurangi setoran per model + warna + ukuran, dihitung langsung
di database dalam satu query agregat dan **tidak disimpan**. Butuh login.

```
kurang = SUM(hasil potongan) - SUM(setoran)   per model + warna + ukuran
```

Query:

| Parameter | Tipe | Bawaan | Keterangan |
|---|---|---|---|
| `pemilikId` | integer min 1 | - | Filter pemilik |
| `modelId` | integer min 1 | - | Filter model |
| `warnaId` | integer min 1 | - | Filter warna |
| `sembunyikanSelesai` | `1` | tampil semua | `1` menyembunyikan kombinasi yang `kurang` 0 di semua ukuran |

Tanpa `sembunyikanSelesai`, semua kombinasi ditampilkan (termasuk yang selesai).
Dokumen halaman `/kurang` di UI memakai default yang sama dengan page-nya,
bukan API ini — kalau ingin perilaku page, kirim `sembunyikanSelesai=1`.

Respons:

```json
{
  "data": [
    {
      "modelId": 9,
      "modelNama": "TES-Doc-Model",
      "pemilikId": 8,
      "pemilikNama": "TES-Doc-Pemilik",
      "warnaId": 13,
      "warnaNama": "TES-Doc-Warna",
      "ukuran": [
        { "label": "L", "kurang": 5 },
        { "label": "2L", "kurang": 0 }
      ],
      "total": 5,
      "selesai": false
    }
  ],
  "totalKurang": 5,
  "jumlahKotak": 1
}
```

Satu entri `data` = satu model + warna (kotak), dengan ringkasan per ukuran.
`kurang` dipotong ke 0 minimum (setoran diblokir melebihi potongan, jadi nilai
negatif hanya muncul kalau data tidak konsisten). `selesai` = `total == 0`.
Kotak **tidak punya field `potong`/`setor`** — hanya `kurang` per ukuran +
`total`. `totalKurang` dan `jumlahKotak` dihitung **setelah**
`sembunyikanSelesai` diterapkan.

Catatan implementasi: query mentah memakai `COALESCE(SUM(...))` dengan `LEFT
JOIN` dari `HasilPotong` ke `SetoranItem`, sehingga kombinasi yang belum
disetor tetap muncul dengan `setor 0`. Baris diurutkan nama pemilik -> model ->
warna di database, lalu ukuran logis saat dikelompokkan jadi kotak.

| Kondisi | Status | `error` |
|---|---|---|
| Belum login | 401 | `Belum login.` |
| `modelId`/`pemilikId`/`warnaId` bukan angka bulat | 400 | `Parameter <nama> harus angka bulat.` |

---

## Menjalankan smoke test## Menjalankan smoke test

Server dev harus sudah jalan, lalu:

```bash
SMOKE_USER=<akun> SMOKE_PASS=<password> ./scripts/smoke-test.sh http://localhost:3000
```

69 pemeriksaan, semuanya memakai data berawalan `TES-` yang dihapus lagi di
akhir. Kredensial hanya dibaca dari environment, tidak pernah ditulis di file.
