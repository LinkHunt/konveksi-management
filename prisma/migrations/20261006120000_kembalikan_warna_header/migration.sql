-- Kembalikan "Transaksi"."warnaId" supaya kode versi lama (Worker produksi)
-- bisa jalan lagi.
--
-- Latar belakang: .env di codespace dan di Worker Cloudflare menunjuk ke
-- database Neon yang sama. Migration 20261005000000 sudah mengubah DB itu,
-- jadi Worker yang masih query t."warnaId" jadi 500 di /, /sisa, dan
-- /api/transaksi.
--
-- Kolom dikembalikan sebagai NULLABLE, dengan trigger yang mengisinya. Dua
-- versi kode harus bisa INSERT ke tabel yang sama pada saat yang sama:
--   - kode lama  menulis Transaksi.warnaId, item cuma bawa ukuran + jumlah
--   - kode baru  menulis TransaksiItem.warnaId, header dikosongkan
--
-- Kenapa tidak NOT NULL: Prisma nested create meng-insert header DULUAN,
-- baru item menyusul. Kolom NOT NULL di-check sebelum AFTER trigger berjalan,
-- jadi kode baru akan gagal di INSERT header sebelum trigger sempat mengisinya.
-- Kenapa trigger (+ kolom pasif), bukan migration reversal biasa: kalau
-- item.warnaId di-drop, insert dari kode lama gagal di NOT NULL. Kalau tidak
-- ada trigger, kode baru meninggalkan header kosong yang tidak bisa dibaca
-- kode lama. Trigger menutup kedua celah itu.

-- AddColumn, nullable. Diisi backfill di bawah untuk data yang sudah ada.
ALTER TABLE "Transaksi" ADD COLUMN "warnaId" INTEGER;

-- Backfill dari warna item. Satu transaksi sekarang bisa punya beberapa warna,
-- jadi baris yang sama muncul di beberapa warna header; ambil yang terkecil
-- supaya hasilnya deterministik. Kolom ini hanya dibaca kode lama, yang selalu
-- satu warna per transaksi.
UPDATE "Transaksi" t
SET "warnaId" = sub."warnaId"
FROM (
  SELECT DISTINCT ON (ti."transaksiId") ti."transaksiId" AS "transaksiId", ti."warnaId" AS "warnaId"
  FROM "TransaksiItem" ti
  ORDER BY ti."transaksiId", ti."warnaId"
) sub
WHERE sub."transaksiId" = t."id" AND t."warnaId" IS NULL;

-- AddForeignKey, sama seperti definisi di migration init.
ALTER TABLE "Transaksi" ADD CONSTRAINT "Transaksi_warnaId_fkey"
    FOREIGN KEY ("warnaId") REFERENCES "Warna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Kode lama: insert item tanpa warnaId. BEFORE INSERT berjalan sebelum
-- constraint NOT NULL dicek, jadi trigger ini boleh mengisi kolom.
CREATE OR REPLACE FUNCTION "isi_warna_item_dari_header"() RETURNS trigger AS $$
DECLARE
  warna_header INTEGER;
BEGIN
  IF NEW."warnaId" IS NULL THEN
    SELECT "warnaId" INTO warna_header FROM "Transaksi" WHERE "id" = NEW."transaksiId";
    IF warna_header IS NOT NULL THEN
      NEW."warnaId" := warna_header;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_item_warna_dari_header"
    BEFORE INSERT ON "TransaksiItem"
    FOR EACH ROW EXECUTE FUNCTION "isi_warna_item_dari_header"();

-- Kode baru: item membawa warnanya sendiri, header dikosongkan. Trigger ini
-- yang mengisi header. AFTER INSERT (bukan BEFORE) karena item-nya belum ada
-- waktu header di-insert.
--
-- Dipasang di TransaksiItem, bukan di Transaksi: kalau dipasang di header,
-- urutannya terbalik dan tidak akan pernah menemukan warna.
CREATE OR REPLACE FUNCTION "isi_warna_header_dari_item"() RETURNS trigger AS $$
BEGIN
  UPDATE "Transaksi" t
  SET "warnaId" = NEW."warnaId"
  WHERE t."id" = NEW."transaksiId" AND t."warnaId" IS NULL;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_header_warna_dari_item"
    AFTER INSERT ON "TransaksiItem"
    FOR EACH ROW EXECUTE FUNCTION "isi_warna_header_dari_item"();

-- Catatan untuk operasi DELETE dari kode lama (hapus item dulu, baru header):
-- item yang dihapus tidak menyentuh trigger AFTER INSERT, jadi header tidak
-- ikut berubah. Kode lama menghapus seluruh isi transaksi lalu insert ulang,
-- jadi header lama sudah dibuang baris-barisnya.
