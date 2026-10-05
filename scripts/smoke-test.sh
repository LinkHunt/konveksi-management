#!/usr/bin/env bash
# Smoke test API Management Konveksi.
#
#   SMOKE_USER=<akun> SMOKE_PASS=<password> ./scripts/smoke-test.sh [BASE_URL]
#
# Semua data uji dibuat dengan awalan "TES-" dan DIHAPUS lagi di akhir, jadi
# skrip aman dijalankan berulang kali. Data yang tidak berawalan "TES-" tidak
# pernah disentuh.
#
# Syarat:
#   - server dev sudah jalan (npm run dev)
#   - jq terpasang
#   - .env berisi DATABASE_URL (dipakai skrip cleanup)
#   - kredensial lewat environment, jangan ditulis di file ini

set -uo pipefail

BASE="${1:-http://localhost:3000}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JAR="$ROOT/.smoke-cookie.txt"
PASS=0
FAIL=0

: "${SMOKE_USER:?SMOKE_USER harus diisi}"
: "${SMOKE_PASS:?SMOKE_PASS harus diisi}"

cleanup() {
  rm -f "$JAR"
  printf '\nMembersihkan data uji...\n'
  node --env-file="$ROOT/.env" "$ROOT/scripts/smoke-cleanup.ts" 2>&1 \
    | grep -vE "MODULE_TYPELESS|Reparsing|To eliminate|trace-warnings" | sed 's/^/  /'
}
trap cleanup EXIT

# ---------- alat bantu ----------

lulus() { PASS=$((PASS+1)); printf '  LULUS  %s\n' "$1"; }
gagal() {
  FAIL=$((FAIL+1))
  printf '  GAGAL  %s (http=%s, hope=%s)\n' "$1" "$LAST_HTTP" "$2"
  printf '         body: %s\n' "$(printf '%s' "${LAST_BODY:-}" | head -c 300)"
}

# panggil <METHOD> <PATH> [JSON_BODY]
panggil() {
  local met="$1" jal="$2" body="${3:-}"
  local out
  if [ -n "$body" ]; then
    out=$(curl -sS -b "$JAR" -c "$JAR" -w $'\n%{http_code}' \
      -X "$met" "$BASE$jal" -H 'Content-Type: application/json' -d "$body")
  else
    out=$(curl -sS -b "$JAR" -c "$JAR" -w $'\n%{http_code}' -X "$met" "$BASE$jal")
  fi
  LAST_HTTP=$(printf '%s' "$out" | tail -n1)
  LAST_BODY=$(printf '%s' "$out" | sed '$d')
  LAST_ID=$(printf '%s' "$LAST_BODY" | jq -r '.data.id // empty' 2>/dev/null)
}

# cek <nama> <http> <substring>
cek() {
  if [ "$LAST_HTTP" = "$2" ] && printf '%s' "$LAST_BODY" | grep -qF -- "$3"; then
    lulus "$1"
  else
    gagal "$1" "$2"
  fi
}

# cekAngka <nama> <http> <jq-filter> <nilai diharapkan>
cekAngka() {
  local got
  got=$(printf '%s' "$LAST_BODY" | jq -r "$3" 2>/dev/null)
  if [ "$LAST_HTTP" = "$2" ] && [ "$got" = "$4" ]; then
    lulus "$1"
  else
    gagal "$1" "$2 (nilai=$got, hope=$4)"
  fi
}

grup() { printf '\n[%s]\n' "$1"; }

printf '== Smoke test %s ==\n' "$BASE"

# ---------- 1. auth ----------

grup "auth"
panggil POST /api/auth/login "{\"username\":\"$SMOKE_USER\",\"password\":\"password-salah-sekali\"}"
cek "login password salah -> 401" 401 "Username atau password salah."
PESAN_SALAH="$LAST_BODY"

panggil POST /api/auth/login '{"username":"akun-tidak-ada-9999","password":"apapun"}'
cek "login username tidak ada -> 401" 401 "Username atau password salah."
cekAngka "pesan gagal login identik" 401 '.error' "$(printf '%s' "$PESAN_SALAH" | jq -r '.error')"

# Semua request berikutnya tanpa cookie harus ditolak.
rm -f "$JAR"
panggil GET /api/master/pemilik
cek "master tanpa cookie -> 401" 401 "Belum login."
panggil GET /api/transaksi
cek "transaksi tanpa cookie -> 401" 401 "Belum login."
panggil GET /api/sisa
cek "sisa tanpa cookie -> 401" 401 "Belum login."
panggil POST /api/transaksi '{"tanggal":"2026-10-01","jenis":"SETORAN","penjahitId":1,"modelId":1,"warnaId":1,"items":[{"ukuran":"M","jumlah":1}]}'
cek "POST tanpa cookie -> 401" 401 "Belum login."

panggil POST /api/auth/login 'bukan json'
cek "body bukan JSON -> 400" 400 "JSON"

panggil POST /api/auth/login "{\"username\":\"$SMOKE_USER\",\"password\":\"$SMOKE_PASS\"}"
cekAngka "login benar -> 200" 200 '.user.id | type' "number"

panggil GET /api/health
cekAngka "health publik hanya ok" 200 '. == {"ok":true}' "true"

# ---------- 2. data master ----------

grup "data master"
panggil GET /api/master/ngawur
cek "entity tak dikenal -> 404" 404 "Jenis data tidak dikenal."

panggil GET /api/master/boss
cek "nama lama 'boss' tidak berlaku -> 404" 404 "Jenis data tidak dikenal."

panggil POST /api/master/pemilik '{"nama":"TES-Pemilik-Smoke"}'
cek "buat pemilik -> 200" 200 '"nama":"TES-Pemilik-Smoke"'
PEMILIK="$LAST_ID"

panggil POST /api/master/pemilik '{"nama":"tes-PEMILIK-smoke"}'
cek "duplikat beda huruf -> 409" 409 "sudah ada"

panggil POST /api/master/pemilik '{"nama":"   "}'
cek "nama spasi doang -> 400" 400 "tidak valid"

panggil POST /api/master/warna '{"nama":"TES-Warna-Smoke"}'
WARNA="$LAST_ID"
panggil POST /api/master/penjahit '{"nama":"TES-Penjahit-Smoke"}'
PENJAHIT="$LAST_ID"

panggil POST /api/master/model '{"nama":"TES-Model-Smoke"}'
cek "model tanpa pemilikId -> 400" 400 "Pemilik wajib dipilih"

panggil POST /api/master/model '{"nama":"TES-Model-Smoke","bossId":999999}'
cekAngka "model pakai bossId ditolak" 400 '.detail.issues[0].field' "pemilikId"

panggil POST /api/master/model '{"nama":"TES-Model-Smoke","pemilikId":999999}'
cek "model pemilikId ngawur -> 400" 400 "Pemilik tidak ditemukan"

panggil POST /api/master/model "{\"nama\":\"TES-Model-Smoke\",\"pemilikId\":$PEMILIK}"
cek "buat model -> 200" 200 '"nama":"TES-Model-Smoke"'
MODEL="$LAST_ID"

panggil POST /api/master/model "{\"nama\":\"TES-Model-Smoke\",\"pemilikId\":$PEMILIK}"
cek "model duplikat pada pemilik sama -> 409" 409 "sudah ada"

panggil GET "/api/master/model?semua=1"
cekAngka "model menyertakan data pemilik" 200 '[.data[] | select(.id == '"$MODEL"')][0].pemilik.id' "$PEMILIK"

panggil GET "/api/master/pemilik/$PEMILIK"
cek "detail pemilik -> 200" 200 '"TES-Pemilik-Smoke"'

panggil GET "/api/master/pemilik/999999"
cek "detail id ngawur -> 404" 404 "tidak ditemukan"

# Warna kedua khusus untuk menguji penolakan master nonaktif. Dipakai di bagian
# transaksi, jadi saat ini belum dipakai transaksi apa pun.
panggil POST /api/master/warna '{"nama":"TES-Warna-Kosong"}'
WARNA_KOSONG="$LAST_ID"

# ---------- 3. transaksi ----------

grup "transaksi"
panggil POST /api/transaksi "{\"tanggal\":\"2026-10-01\",\"jenis\":\"BAHAN_KELUAR\",\"penjahitId\":$PENJAHIT,\"modelId\":$MODEL,\"warnaId\":$WARNA,\"items\":[{\"ukuran\":\"L\",\"jumlah\":10},{\"ukuran\":\"2L\",\"jumlah\":5}]}"
cek "BAHAN_KELUAR L=10 2L=5 -> 200" 200 '"totalPcs":15'
cekAngka "ukuran keluar sebagai label 2L" 200 '.data.items | map(.ukuran) | join(",")' "L,2L"
cekAngka "tanggal tetap 2026-10-01 (WIB)" 200 '.data.tanggal' "2026-10-01"
cekAngka "transaksi menyertakan pemilik" 200 '.data.pemilik.id' "$PEMILIK"

panggil POST /api/transaksi "{\"tanggal\":\"2026-10-02\",\"jenis\":\"SETORAN\",\"penjahitId\":$PENJAHIT,\"modelId\":$MODEL,\"warnaId\":$WARNA,\"items\":[{\"ukuran\":\"M\",\"jumlah\":3},{\"ukuran\":\"S\",\"jumlah\":0}]}"
cekAngka "item jumlah 0 dibuang" 200 '.data.totalPcs' "3"
cekAngka "hanya M yang tersisa" 200 '.data.items | length' "1"

panggil POST /api/transaksi "{\"tanggal\":\"2026-10-03\",\"jenis\":\"SETORAN\",\"penjahitId\":$PENJAHIT,\"modelId\":$MODEL,\"warnaId\":$WARNA,\"items\":[{\"ukuran\":\"XL\",\"jumlah\":7}]}"
cekAngka "SETORAN XL=7 tersimpan" 200 '.data.totalPcs' "7"

# Pasangan XS untuk menguji baris sisa tepat 0 (sembunyikanNol).
panggil POST /api/transaksi "{\"tanggal\":\"2026-10-06\",\"jenis\":\"BAHAN_KELUAR\",\"penjahitId\":$PENJAHIT,\"modelId\":$MODEL,\"warnaId\":$WARNA,\"items\":[{\"ukuran\":\"XS\",\"jumlah\":2}]}"
cekAngka "BAHAN_KELUAR XS=2 tersimpan" 200 '.data.totalPcs' "2"

panggil POST /api/transaksi "{\"tanggal\":\"2026-10-07\",\"jenis\":\"SETORAN\",\"penjahitId\":$PENJAHIT,\"modelId\":$MODEL,\"warnaId\":$WARNA,\"items\":[{\"ukuran\":\"XS\",\"jumlah\":2}]}"
cekAngka "SETORAN XS=2 tersimpan" 200 '.data.totalPcs' "2"

# Validasi penolakan. Semua harus ditolak, jadi tidak menambah transaksi.
panggil POST /api/transaksi "{\"tanggal\":\"2026-10-02\",\"jenis\":\"SETORAN\",\"penjahitId\":$PENJAHIT,\"modelId\":$MODEL,\"warnaId\":$WARNA,\"items\":[{\"ukuran\":\"M\",\"jumlah\":0}]}"
cek "semua jumlah 0 -> 400" 400 "Minimal satu baris"

panggil POST /api/transaksi "{\"tanggal\":\"2026-10-02\",\"jenis\":\"SETORAN\",\"penjahitId\":$PENJAHIT,\"modelId\":$MODEL,\"warnaId\":$WARNA,\"items\":[{\"ukuran\":\"M\",\"jumlah\":1},{\"ukuran\":\"M\",\"jumlah\":2}]}"
cek "ukuran dobel -> 400" 400 "lebih dari sekali"

panggil POST /api/transaksi "{\"tanggal\":\"2026-10-02\",\"jenis\":\"SETORAN\",\"penjahitId\":$PENJAHIT,\"modelId\":$MODEL,\"warnaId\":$WARNA,\"items\":[{\"ukuran\":\"9L\",\"jumlah\":1}]}"
cek "ukuran ngawur -> 400" 400 "tidak valid"

panggil POST /api/transaksi "{\"tanggal\":\"2026-10-02\",\"jenis\":\"SETORAN\",\"penjahitId\":$PENJAHIT,\"modelId\":$MODEL,\"warnaId\":$WARNA,\"items\":[{\"ukuran\":\"M\",\"jumlah\":-5}]}"
cek "jumlah negatif -> 400" 400 "Minimal satu baris"

panggil POST /api/transaksi "{\"tanggal\":\"2026-02-31\",\"jenis\":\"SETORAN\",\"penjahitId\":$PENJAHIT,\"modelId\":$MODEL,\"warnaId\":$WARNA,\"items\":[{\"ukuran\":\"M\",\"jumlah\":1}]}"
cek "tanggal ngawur -> 400" 400 "Tanggal tidak valid"

panggil POST /api/transaksi "{\"tanggal\":\"2026-10-02\",\"jenis\":\"NGAWUR\",\"penjahitId\":$PENJAHIT,\"modelId\":$MODEL,\"warnaId\":$WARNA,\"items\":[{\"ukuran\":\"M\",\"jumlah\":1}]}"
cek "jenis ngawur -> 400" 400 "tidak valid"

panggil POST /api/transaksi "{\"tanggal\":\"2026-10-02\",\"jenis\":\"SETORAN\",\"penjahitId\":$PENJAHIT,\"modelId\":$MODEL,\"warnaId\":999999,\"items\":[{\"ukuran\":\"M\",\"jumlah\":1}]}"
cek "warna tidak ada -> 400" 400 "Warna tidak ditemukan"

panggil PATCH "/api/master/warna/$WARNA_KOSONG" '{"aktif":false}'
cek "nonaktifkan warna yang belum dipakai -> 200" 200 '"aktif":false'

panggil POST /api/transaksi "{\"tanggal\":\"2026-10-02\",\"jenis\":\"SETORAN\",\"penjahitId\":$PENJAHIT,\"modelId\":$MODEL,\"warnaId\":$WARNA_KOSONG,\"items\":[{\"ukuran\":\"M\",\"jumlah\":1}]}"
cek "transaksi pakai warna nonaktif -> 400" 400 "nonaktif"

# Transaksi terpisah untuk menguji PUT.
panggil POST /api/transaksi "{\"tanggal\":\"2026-10-04\",\"jenis\":\"BAHAN_KELUAR\",\"penjahitId\":$PENJAHIT,\"modelId\":$MODEL,\"warnaId\":$WARNA,\"items\":[{\"ukuran\":\"S\",\"jumlah\":4}]}"
PUT_UJI="$LAST_ID"

panggil PUT "/api/transaksi/$PUT_UJI" "{\"tanggal\":\"2026-10-04\",\"jenis\":\"BAHAN_KELUAR\",\"penjahitId\":$PENJAHIT,\"modelId\":$MODEL,\"warnaId\":$WARNA,\"items\":[{\"ukuran\":\"3L\",\"jumlah\":7},{\"ukuran\":\"8L\",\"jumlah\":2}]}"
cekAngka "PUT ganti items -> 200" 200 '.data.totalPcs' "9"
cekAngka "items terurut logis 3L lalu 8L" 200 '.data.items | map(.ukuran) | join(",")' "3L,8L"

panggil GET "/api/transaksi/$PUT_UJI"
cekAngka "GET transaksi -> totalPcs 9" 200 '.data.totalPcs' "9"

# Total transaksi sekarang: 6 (3 BAHAN_KELUAR + 3 SETORAN).
panggil GET "/api/transaksi?jenis=BAHAN_KELUAR&limit=10"
cekAngka "filter jenis BAHAN_KELUAR" 200 '.paging.total' "3"

panggil GET "/api/transaksi?jenis=SETORAN&limit=10"
cekAngka "filter jenis SETORAN" 200 '.paging.total' "3"

panggil GET "/api/transaksi?tanggalDari=2026-10-02&tanggalSampai=2026-10-02"
cekAngka "filter rentang tanggal inklusif" 200 '.paging.total' "1"

panggil GET "/api/transaksi?limit=101"
cek "limit di atas batas -> 400" 400 "maksimal"

panggil GET "/api/transaksi?pemilikId=$PEMILIK&limit=10"
cekAngka "filter pemilikId" 200 '.paging.total' "6"

panggil GET "/api/transaksi?penjahitId=$PENJAHIT&modelId=$MODEL&warnaId=$WARNA&limit=10"
cekAngka "filter gabungan" 200 '.paging.total' "6"

# ---------- 4. sisa ----------

grup "sisa"
# Perhitungan manual dari transaksi yang sudah dibuat:
#
#   10-01 BAHAN_KELUAR  L=10  2L=5
#   10-02 SETORAN       M=3          (S=0 dibuang)
#   10-03 SETORAN       XL=7
#   10-04 BAHAN_KELUAR  3L=7  8L=2   (hasil PUT, sebelumnya S=4)
#   10-06 BAHAN_KELUAR  XS=2
#   10-07 SETORAN       XS=2
#
# sisa = bahan keluar - setoran, per ukuran:
#   XS = 2  - 2  =  0   disembunyikan default
#   M  = 0  - 3  = -3   lebih
#   L  = 10 - 0  = 10
#   XL = 0  - 7  = -7   lebih
#   2L = 5  - 0  =  5
#   3L = 7  - 0  =  7
#   8L = 2  - 0  =  2
#   S  tidak ada (diganti PUT)
#
# total bahan keluar = 15 + 9 + 2 = 26
# total setoran      =  3 + 7 + 2 = 12
# total sisa         = 26 - 12 = 14
#
# CATATAN: default XS disembunyikan (sisa 0), jadi total dihitung dari baris yang
# terlihat saja: bahan keluar 24 (XS 2 tidak ikut), setoran 10 (XS 2 tidak ikut),
# sisa 14 tetap sama karena XS saling menghapus. Baris XS yang disembunyikan
# terlihat lagi dengan sembunyikanNol=0, dan totalnya ikut jadi 26 dan 12.
panggil GET "/api/sisa?penjahitId=$PENJAHIT"
cekAngka "sisa L = 10" 200 '.data[0].baris[] | select(.ukuran=="L") | .sisa' "10"
cekAngka "sisa 2L = 5 (label asli, bukan L2)" 200 '.data[0].baris[] | select(.ukuran=="2L") | .sisa' "5"
cekAngka "sisa 3L = 7" 200 '.data[0].baris[] | select(.ukuran=="3L") | .sisa' "7"
cekAngka "sisa 8L = 2" 200 '.data[0].baris[] | select(.ukuran=="8L") | .sisa' "2"
cekAngka "sisa M = -3 (tidak dipotong ke 0)" 200 '.data[0].baris[] | select(.ukuran=="M") | .sisa' "-3"
cekAngka "sisa XL = -7 (tidak dipotong ke 0)" 200 '.data[0].baris[] | select(.ukuran=="XL") | .sisa' "-7"
cekAngka "bahanKeluar L = 10" 200 '.data[0].baris[] | select(.ukuran=="L") | .bahanKeluar' "10"
cekAngka "setoran L = 0" 200 '.data[0].baris[] | select(.ukuran=="L") | .setoran' "0"
cekAngka "baris M ditandai lebih" 200 '.data[0].baris[] | select(.ukuran=="M") | .lebih' "true"
cekAngka "baris XL ditandai lebih" 200 '.data[0].baris[] | select(.ukuran=="XL") | .lebih' "true"
cekAngka "baris L tidak ditandai lebih" 200 '.data[0].baris[] | select(.ukuran=="L") | .lebih' "false"
cekAngka "baris menyertakan nama pemilik" 200 '.data[0].baris[0].pemilikNama' "TES-Pemilik-Smoke"
cekAngka "baris menyertakan nama penjahit" 200 '.data[0].baris[0].penjahitNama' "TES-Penjahit-Smoke"
cekAngka "baris menyertakan nama model" 200 '.data[0].baris[0].modelNama' "TES-Model-Smoke"
cekAngka "totalSisa = 14" 200 '.data[0].totalSisa' "14"
cekAngka "totalBahanKeluar = 24 (baris tersembunyi tidak ikut)" 200 '.data[0].totalBahanKeluar' "24"
cekAngka "totalSetoran = 10 (baris tersembunyi tidak ikut)" 200 '.data[0].totalSetoran' "10"
cekAngka "adaLebih true" 200 '.data[0].adaLebih' "true"
cekAngka "XS sisa 0 disembunyikan default" 200 '[.data[0].baris[] | select(.ukuran=="XS")] | length' "0"
cekAngka "S tidak muncul (diganti PUT)" 200 '[.data[0].baris[] | select(.ukuran=="S")] | length' "0"
cekAngka "ukuran terurut logis" 200 '[.data[0].baris[].ukuran] | join(",")' "M,L,XL,2L,3L,8L"

panggil GET "/api/sisa?penjahitId=$PENJAHIT&sembunyikanNol=0"
cekAngka "sembunyikanNol=0 memunculkan XS sisa 0" 200 '[.data[0].baris[] | select(.ukuran=="XS" and .sisa==0)] | length' "1"
cekAngka "sembunyikanNol=0 jumlah baris 7" 200 '.data[0].baris | length' "7"
cekAngka "sembunyikanNol=0 total ikut baris tersembunyi" 200 '.data[0].totalBahanKeluar' "26"
cekAngka "sembunyikanNol=0 total setoran ikut" 200 '.data[0].totalSetoran' "12"
cekAngka "sembunyikanNol=0 totalSisa tetap 14" 200 '.data[0].totalSisa' "14"

panggil GET "/api/sisa?pemilikId=$PEMILIK"
cekAngka "sisa filter pemilikId" 200 '.data | length' "1"

panggil GET "/api/sisa?penjahitId=$PENJAHIT&modelId=$MODEL"
cekAngka "sisa filter modelId" 200 '.data[0].baris | length' "6"

panggil GET "/api/sisa?warnaId=999999"
cekAngka "sisa tanpa hasil -> data kosong" 200 '.data | length' "0"
cekAngka "ringkasan tetap ikut" 200 '.ringkasan.totalSisa' "0"

panggil GET "/api/sisa?penjahitId=abc"
cek "filter bukan angka -> 400" 400 "harus angka bulat"

# ---------- 5. master terpakai tidak boleh dinonaktifkan ----------

grup "master terpakai"
panggil PATCH "/api/master/penjahit/$PENJAHIT" '{"aktif":false}'
cek "nonaktifkan penjahit terpakai -> 409" 409 "masih dipakai"
panggil PATCH "/api/master/model/$MODEL" '{"aktif":false}'
cek "nonaktifkan model terpakai -> 409" 409 "masih dipakai"
panggil PATCH "/api/master/pemilik/$PEMILIK" '{"aktif":false}'
cek "nonaktifkan pemilik terpakai -> 409" 409 "masih dipakai"
panggil PATCH "/api/master/warna/$WARNA" '{"aktif":false}'
cek "nonaktifkan warna terpakai -> 409" 409 "masih dipakai"

# ---------- 6. CSRF ----------

grup "csrf"
CSRF=$(curl -sS -o /dev/null -w '%{http_code}' -b "$JAR" -X POST "$BASE/api/master/warna" \
  -H 'Content-Type: application/json' -H 'Origin: https://jahat.example' -d '{"nama":"TES-Csrf"}')
if [ "$CSRF" = "403" ]; then
  lulus "Origin beda host -> 403"
else
  FAIL=$((FAIL+1)); printf '  GAGAL  Origin beda host -> 403 (http=%s)\n' "$CSRF"
fi

# ---------- 7. DELETE transaksi ----------

grup "delete transaksi"
panggil DELETE "/api/transaksi/$PUT_UJI"
cek "DELETE transaksi -> 200" 200 '"ok":true'
panggil GET "/api/transaksi/$PUT_UJI"
cek "GET transaksi terhapus -> 404" 404 "tidak ditemukan"
panggil DELETE "/api/transaksi/$PUT_UJI"
cek "DELETE transaksi yang sudah hilang -> 404" 404 "tidak ditemukan"

# ---------- 8. logout ----------

grup "logout"
panggil POST /api/auth/logout
cek "logout -> 200" 200 '"ok":true'
panggil GET /api/master/pemilik
cek "sesi mati setelah logout -> 401" 401 "Belum login."

# ---------- ringkasan ----------

printf '\n== %s lulus, %s gagal ==\n' "$PASS" "$FAIL"
if [ "$FAIL" -ne 0 ]; then
  echo "Ada kasus gagal. Data uji tetap dibersihkan oleh trap."
  exit 1
fi
echo "Semua smoke test lulus."