#!/usr/bin/env bash
# Smoke test API Management Konveksi.
#
#   SMOKE_USER=<akun> SMOKE_PASS=<password> ./scripts/smoke-test.sh [BASE_URL]
#
# Data uji semuanya berawalan "TES-" dan DIHAPUS lagi di akhir, jadi skrip aman
# dijalankan berulang kali. Data yang tidak berawalan "TES-" tidak disentuh.
#
# Alur uji (domain hasil potong -> setoran -> kurang):
#   - buat pemilik + model + warna TES-
#   - catat hasil potongan (sumber data), koreksi, hapus, riwayat
#   - catat setoran (tidak boleh melebihi target hasil potong)
#   - cek agregat kurang
#   - cek master terpakai tidak bisa dinonaktifkan
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
  # POST /api/setoran -> {ok:true, id}; POST /api/master/* -> {data:{id}}. Ambil dua-duanya.
  LAST_ID=$(printf '%s' "$LAST_BODY" | jq -r '.id // .data.id // empty' 2>/dev/null)
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
panggil GET /api/hasil-potong
cek "hasil-potong tanpa cookie -> 401" 401 "Belum login."
panggil GET /api/setoran
cek "setoran tanpa cookie -> 401" 401 "Belum login."
panggil GET /api/kurang
cek "kurang tanpa cookie -> 401" 401 "Belum login."

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

panggil POST /api/master/pemilik '{"nama":"TES-Pemilik-Smoke"}'
cek "buat pemilik -> 200" 200 '"nama":"TES-Pemilik-Smoke"'
PEMILIK="$LAST_ID"

panggil POST /api/master/pemilik '{"nama":"tes-PEMILIK-smoke"}'
cek "duplikat beda huruf -> 409" 409 "sudah ada"

panggil POST /api/master/warna '{"nama":"TES-Warna-Smoke"}'
WARNA="$LAST_ID"
panggil POST /api/master/warna '{"nama":"TES-Warna-Kedua"}'
WARNA2="$LAST_ID"

panggil POST /api/master/model '{"nama":"TES-Model-Smoke"}'
cek "model tanpa pemilikId -> 400" 400 "Pemilik wajib dipilih"

panggil POST /api/master/model "{\"nama\":\"TES-Model-Smoke\",\"pemilikId\":999999}"
cek "model pemilikId ngawur -> 400" 400 "Pemilik tidak ditemukan"

panggil POST /api/master/model "{\"nama\":\"TES-Model-Smoke\",\"pemilikId\":$PEMILIK}"
cek "buat model -> 200" 200 '"nama":"TES-Model-Smoke"'
MODEL="$LAST_ID"

panggil POST /api/master/model "{\"nama\":\"TES-Model-Smoke\",\"pemilikId\":$PEMILIK}"
cek "model duplikat pada pemilik sama -> 409" 409 "sudah ada"

panggil GET "/api/master/model?semua=1"
cekAngka "model menyertakan data pemilik" 200 '[.data[] | select(.id == '"$MODEL"')][0].pemilik.id' "$PEMILIK"

panggil GET "/api/master/model/$MODEL"
cek "detail model -> 200" 200 '"TES-Model-Smoke"'

panggil GET "/api/master/pemilik/999999"
cek "detail id ngawur -> 404" 404 "tidak ditemukan"

panggil GET "/api/master/penjahit"
cek "penjahit masih ada di master (belum dihapus sengaja)" 200 '"data"'

# ---------- 3. hasil potong ----------

grup "hasil potong"

# Warnanya harus aktif sebelum dipakai.
panggil POST /api/hasil-potong "{\"modelId\":$MODEL,\"baris\":[{\"warnaId\":$WARNA,\"ukuran\":\"L\",\"jumlah\":10},{\"warnaId\":$WARNA,\"ukuran\":\"2L\",\"jumlah\":5}]}"
cek "catat hasil potong -> 200" 200 '"ok":true'

panggil POST /api/hasil-potong "{\"modelId\":$MODEL,\"baris\":[{\"warnaId\":$WARNA,\"ukuran\":\"L\",\"jumlah\":12}]}"
cek "timpa ukuran L -> 200" 200 '"ok":true'

panggil GET /api/hasil-potong
cekAngka "L jadi 12 (karena ditimpa)" 200 '[.data[] | select(.modelId == '"$MODEL"') | .warna[] | select(.warnaId == '"$WARNA"') | .baris[] | select(.ukuran=="L") | .jumlah] | add' "12"
cekAngka "2L tetap 5" 200 '[.data[] | select(.modelId == '"$MODEL"') | .warna[] | select(.warnaId == '"$WARNA"') | .baris[] | select(.ukuran=="2L") | .jumlah] | add' "5"
cekAngka "total model = 17" 200 '[.data[] | select(.modelId == '"$MODEL"') | .total] | add' "17"
cekAngka "pemilik model tercantum" 200 '[.data[] | select(.modelId == '"$MODEL"') | .pemilikNama] | add' "TES-Pemilik-Smoke"

# Baris kedua: untuk menguji hapus bebas (belum ada setoran) dan filter warna.
panggil POST /api/hasil-potong "{\"modelId\":$MODEL,\"baris\":[{\"warnaId\":$WARNA2,\"ukuran\":\"M\",\"jumlah\":3}]}"
cek "catat hasil potong warna kedua -> 200" 200 '"ok":true'

# Ambil id baris WARNA ukuran L dan M untuk uji aksi.
panggil GET /api/hasil-potong
ID_L=$(printf '%s' "$LAST_BODY" | jq -r '[.data[] | select(.modelId == '"$MODEL"') | .warna[] | select(.warnaId == '"$WARNA"') | .baris[] | select(.ukuran=="L") | .id][0]')
ID_M=$(printf '%s' "$LAST_BODY" | jq -r '[.data[] | select(.modelId == '"$MODEL"') | .warna[] | select(.warnaId == '"$WARNA2"') | .baris[] | select(.ukuran=="M") | .id][0]')

# Riwayat baris yang ditimpa harus berisi BUAT dan UBAH.
panggil GET "/api/hasil-potong/$ID_L"
cekAngka "riwayat L: aksi terakhir UBAH" 200 '.data[0].aksi' "UBAH"
cekAngka "riwayat L: jumlah baru 12" 200 '.data[0].jumlahBaru' "12"

# Batas koreksi: belum ada setoran, L boleh turun bebas.
panggil PUT "/api/hasil-potong/$ID_L" '{"jumlah":6}'
cek "koreksi L 12->6 -> 200" 200 '"ok":true'
panggil GET "/api/hasil-potong/$ID_L"
cekAngka "riwayat L: aksi UBAH kedua" 200 '.data[0].aksi' "UBAH"
cekAngka "riwayat L: lama 12 baru 6" 200 '.data[0].jumlahLama' "12"
cekAngka "riwayat L: jumlahBaru 6" 200 '.data[0].jumlahBaru' "6"

# ---------- 4. setoran ----------

grup "setoran"

# Setoran MELEBIHI target ditolak: L potongan 6, isi 8.
panggil POST /api/setoran "{\"tanggal\":\"2026-10-06\",\"items\":[{\"modelId\":$MODEL,\"warnaId\":$WARNA,\"ukuran\":\"L\",\"jumlah\":8}]}"
cek "setoran melebihi target -> 400" 400 "melebihi target"
cekAngka "pesan menyebut sisa 6" 400 '.error | contains("tersisa 6")' "true"

# Setoran valid.
panggil POST /api/setoran "{\"tanggal\":\"2026-10-06\",\"catatan\":\"tes\",\"items\":[{\"modelId\":$MODEL,\"warnaId\":$WARNA,\"ukuran\":\"L\",\"jumlah\":5}]}"
cek "setoran L=5 -> 200" 200 '"ok"'
SETORAN="$LAST_ID"

# Sekarang sisa target L = 6 - 5 = 1. Isi 2 -> ditolak.
panggil POST /api/setoran "{\"tanggal\":\"2026-10-06\",\"items\":[{\"modelId\":$MODEL,\"warnaId\":$WARNA,\"ukuran\":\"L\",\"jumlah\":2}]}"
cek "setoran 2 melebihi sisa 1 -> 400" 400 "melebihi target"

panggil POST /api/setoran "{\"tanggal\":\"2026-10-06\",\"items\":[{\"modelId\":$MODEL,\"warnaId\":$WARNA2,\"ukuran\":\"M\",\"jumlah\":3}]}"
cek "setoran M=3 (sama target) -> 200" 200 '"ok"'

# Hitung sisa: L potong 6 setor 5 -> kurang 1; M potong 3 setor 3 -> kurang 0.
panggil GET "/api/kurang?modelId=$MODEL"
cekAngka "kurang L = 1" 200 '[.data[] | select(.modelId == '"$MODEL"' and .warnaId == '"$WARNA"') | .ukuran[] | select(.label=="L") | .kurang] | add' "1"
cekAngka "kurang M = 0 (disetor penuh)" 200 '[.data[] | select(.modelId == '"$MODEL"' and .warnaId == '"$WARNA2"') | .ukuran[] | select(.label=="M") | .kurang] | add' "0"
cekAngka "kurang 2L = 5 (belum disetor)" 200 '[.data[] | select(.modelId == '"$MODEL"' and .warnaId == '"$WARNA"') | .ukuran[] | select(.label=="2L") | .kurang] | add' "5"
# .total = jumlah SELURUH ukuran dalam satu kotak (model+warna) = L 1 + 2L 5.
cekAngka "total kotak WARNA = 6 (L 1 + 2L 5)" 200 '[.data[] | select(.modelId == '"$MODEL"' and .warnaId == '"$WARNA"') | .total] | add' "6"

# sembunyikanSelesai: default route /api/kurang menampilkan SEMUA kotak (termasuk
# yang selesai). sembunyikanSelesai=1 yang menyembunyikan kotak M (kurang 0 semua).
panggil GET "/api/kurang?modelId=$MODEL"
cekAngka "M tampil di default" 200 '[.data[] | select(.warnaId == '"$WARNA2"')] | length' "1"
panggil GET "/api/kurang?modelId=$MODEL&sembunyikanSelesai=1"
cekAngka "M disembunyikan dengan sembunyikanSelesai=1" 200 '[.data[] | select(.warnaId == '"$WARNA2"')] | length' "0"
panggil GET "/api/kurang?modelId=$MODEL&sembunyikanSelesai=0"
cekAngka "M muncul dengan sembunyikanSelesai=0" 200 '[.data[] | select(.warnaId == '"$WARNA2"')] | length' "1"

# ---------- 5. batas A11: koreksi & hapus di bawah setoran ----------

grup "batas A11 (koreksi/hapus potong)"

# L sudah disetor 5. Koreksi turun ke 4 -> ditolak.
panggil PUT "/api/hasil-potong/$ID_L" '{"jumlah":4}'
cek "koreksi L < total setoran (5) -> 400" 400 "tidak bisa diturunkan"

# Hapus L (sudah disetor) -> ditolak.
panggil DELETE "/api/hasil-potong/$ID_L"
cek "hapus L yang sudah disetor -> 400" 400 "sudah disetor"

# M (WARNA2) masih bebas: setoran sama dengan potongan, tapi ini belum dihapus.
# Hapus M -> harus ditolak juga karena sudah punya setoran.
panggil DELETE "/api/hasil-potong/$ID_M"
cek "hapus M yang sudah disetor -> 400" 400 "sudah disetor"

# Baris 2L belum disetor sama sekali -> bisa dihapus. Ambil id-nya.
panggil GET /api/hasil-potong
ID_2L=$(printf '%s' "$LAST_BODY" | jq -r '[.data[] | select(.modelId == '"$MODEL"') | .warna[] | select(.warnaId == '"$WARNA"') | .baris[] | select(.ukuran=="2L") | .id][0]')
panggil DELETE "/api/hasil-potong/$ID_2L"
cek "hapus 2L (belum disetor) -> 200" 200 '"ok"'
panggil GET "/api/hasil-potong/$ID_2L"
cekAngka "riwayat 2L: aksi HAPUS" 200 '.data[0].aksi' "HAPUS"

# ---------- 6. edit & hapus setoran ----------

grup "edit setoran"

panggil GET "/api/setoran/$SETORAN"
cekAngka "detail setoran -> totalPcs 5" 200 '.data.totalPcs' "5"
cekAngka "detail setoran tanggal tetap" 200 '.data.tanggal' "2026-10-06"
cekAngka "detail setoran catatan tersimpan" 200 '.data.catatan' "tes"

# PUT ganti isi setoran L=5 jadi L=2 (sisa target L = 6-2 = 4).
panggil PUT "/api/setoran/$SETORAN" "{\"tanggal\":\"2026-10-06\",\"items\":[{\"modelId\":$MODEL,\"warnaId\":$WARNA,\"ukuran\":\"L\",\"jumlah\":2}]}"
cekAngka "PUT setoran L=2 -> totalPcs 2" 200 '.data.totalPcs' "2"

# Setoran yang sedang diedit dikecualikan dari hitungan kuota: isi L=5 lagi.
panggil PUT "/api/setoran/$SETORAN" "{\"tanggal\":\"2026-10-06\",\"items\":[{\"modelId\":$MODEL,\"warnaId\":$WARNA,\"ukuran\":\"L\",\"jumlah\":5}]}"
cekAngka "PUT setoran L=5 -> totalPcs 5" 200 '.data.totalPcs' "5"

panggil GET "/api/setoran"
cekAngka "riwayat setoran jumlah 2" 200 '.data | length' "2"

panggil DELETE "/api/setoran/$SETORAN"
cek "hapus setoran -> 200" 200 '"ok"'
panggil GET "/api/setoran/$SETORAN"
cek "GET setoran terhapus -> 404" 404 "tidak ditemukan"

# ---------- 7. kurang dengan filter ----------

grup "filter kurang"
# Default route = tampil SEMUA kotak (M + WARNA yang belum lunas 2L). L lunas tapi
# masih muncul karena default bukan sembunyikanSelesai.
panggil GET "/api/kurang?pemilikId=$PEMILIK"
cekAngka "filter pemilikId menghitung 2 kotak (semua tampil di default)" 200 '.data | length' "2"
panggil GET "/api/kurang?warnaId=999999"
cekAngka "warna tak ada -> data kosong" 200 '.data | length' "0"
panggil GET "/api/kurang?modelId=abc"
cek "filter bukan angka -> 400" 400 "harus angka bulat"

# totalKurang ikut di payload.
panggil GET "/api/kurang?modelId=$MODEL&sembunyikanSelesai=0"
cekAngka "jumlahKotak ikut" 200 '.jumlahKotak' "2"

# ---------- 8. master terpakai tidak boleh dinonaktifkan ----------

grup "master terpakai"
panggil PATCH "/api/master/model/$MODEL" '{"aktif":false}'
cek "nonaktifkan model terpakai -> 409" 409 "masih dipakai"
panggil PATCH "/api/master/warna/$WARNA" '{"aktif":false}'
cek "nonaktifkan warna terpakai -> 409" 409 "masih dipakai"
panggil PATCH "/api/master/pemilik/$PEMILIK" '{"aktif":false}'
cek "nonaktifkan pemilik terpakai -> 409" 409 "masih dipakai"

# ---------- 9. CSRF ----------

grup "csrf"
CSRF=$(curl -sS -o /dev/null -w '%{http_code}' -b "$JAR" -X POST "$BASE/api/hasil-potong" \
  -H 'Content-Type: application/json' -H 'Origin: https://jahat.example' \
  -d "{\"modelId\":$MODEL,\"baris\":[{\"warnaId\":$WARNA2,\"ukuran\":\"XL\",\"jumlah\":1}]}")
if [ "$CSRF" = "403" ]; then
  lulus "Origin beda host -> 403"
else
  FAIL=$((FAIL+1)); printf '  GAGAL  Origin beda host -> 403 (http=%s)\n' "$CSRF"
fi

# ---------- 10. logout ----------

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