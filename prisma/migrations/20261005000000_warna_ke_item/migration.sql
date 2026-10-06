-- Pindahkan warna dari header Transaksi ke TransaksiItem.
--
-- Alasan: satu pengambilan bahan sering punya lebih dari satu warna, tiap warna
-- dengan ukuran sendiri. Schema lama hanya bisa menyimpan satu warna per
-- transaksi dan menolak ukuran yang sama dua kali dalam satu transaksi, jadi
-- dua warna dengan ukuran sama tidak bisa dicatat.
--
-- Contoh yang harus bisa tersimpan setelah migrasi ini:
--   a deri ambil: Merah XL=4, Merah 3L=4, Toska L=20  -> satu transaksi
--
-- Pendekatan: tambah kolom baru di TransaksiItem, isi dari header, baru
-- hapus yang lama. Dengan begitu tidak ada baris yang hilang di tengah jalan.

-- AddColumn
ALTER TABLE "TransaksiItem" ADD COLUMN "warnaId" INTEGER;

-- Backfill: setiap item mewarisi warna dari header transaksinya.
UPDATE "TransaksiItem" ti
SET "warnaId" = t."warnaId"
FROM "Transaksi" t
WHERE t."id" = ti."transaksiId";

-- Hapus sisa item tanpa warna (harusnya tidak ada, tapi dijamin tidak null).
DELETE FROM "TransaksiItem" WHERE "warnaId" IS NULL;

-- AddColumn (warnaId sekarang wajib)
ALTER TABLE "TransaksiItem" ALTER COLUMN "warnaId" SET NOT NULL;

-- DropIndex
DROP INDEX "TransaksiItem_transaksiId_ukuran_key";

-- CreateIndex: satu warna + satu ukuran hanya boleh muncul sekali per transaksi.
CREATE UNIQUE INDEX "TransaksiItem_transaksiId_warnaId_ukuran_key"
    ON "TransaksiItem"("transaksiId", "warnaId", "ukuran");

-- CreateIndex (filter sisa per warna)
CREATE INDEX "TransaksiItem_warnaId_idx" ON "TransaksiItem"("warnaId");

-- AddForeignKey
ALTER TABLE "TransaksiItem" ADD CONSTRAINT "TransaksiItem_warnaId_fkey"
    FOREIGN KEY ("warnaId") REFERENCES "Warna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropForeignKey: warna tidak lagi dimiliki header.
ALTER TABLE "Transaksi" DROP CONSTRAINT "Transaksi_warnaId_fkey";

-- DropColumn
ALTER TABLE "Transaksi" DROP COLUMN "warnaId";