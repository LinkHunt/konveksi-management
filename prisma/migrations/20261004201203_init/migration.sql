-- CreateEnum
CREATE TYPE "Ukuran" AS ENUM ('XS', 'S', 'M', 'L', 'XL', '2L', '3L', '5L', '8L');

-- CreateEnum
CREATE TYPE "JenisTransaksi" AS ENUM ('BAHAN_KELUAR', 'SETORAN');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Boss" (
    "id" SERIAL NOT NULL,
    "nama" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Boss_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelBaju" (
    "id" SERIAL NOT NULL,
    "nama" TEXT NOT NULL,
    "bossId" INTEGER NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ModelBaju_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warna" (
    "id" SERIAL NOT NULL,
    "nama" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Warna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Penjahit" (
    "id" SERIAL NOT NULL,
    "nama" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Penjahit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaksi" (
    "id" SERIAL NOT NULL,
    "tanggal" DATE NOT NULL,
    "jenis" "JenisTransaksi" NOT NULL,
    "penjahitId" INTEGER NOT NULL,
    "modelId" INTEGER NOT NULL,
    "warnaId" INTEGER NOT NULL,
    "catatan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaksi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransaksiItem" (
    "id" SERIAL NOT NULL,
    "transaksiId" INTEGER NOT NULL,
    "ukuran" "Ukuran" NOT NULL,
    "jumlah" INTEGER NOT NULL,

    CONSTRAINT "TransaksiItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Boss_nama_key" ON "Boss"("nama");

-- CreateIndex
CREATE UNIQUE INDEX "ModelBaju_bossId_nama_key" ON "ModelBaju"("bossId", "nama");

-- CreateIndex
CREATE UNIQUE INDEX "Warna_nama_key" ON "Warna"("nama");

-- CreateIndex
CREATE UNIQUE INDEX "Penjahit_nama_key" ON "Penjahit"("nama");

-- CreateIndex
CREATE INDEX "Transaksi_tanggal_idx" ON "Transaksi"("tanggal");

-- CreateIndex
CREATE INDEX "Transaksi_penjahitId_jenis_idx" ON "Transaksi"("penjahitId", "jenis");

-- CreateIndex
CREATE UNIQUE INDEX "TransaksiItem_transaksiId_ukuran_key" ON "TransaksiItem"("transaksiId", "ukuran");

-- AddForeignKey
ALTER TABLE "ModelBaju" ADD CONSTRAINT "ModelBaju_bossId_fkey" FOREIGN KEY ("bossId") REFERENCES "Boss"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaksi" ADD CONSTRAINT "Transaksi_penjahitId_fkey" FOREIGN KEY ("penjahitId") REFERENCES "Penjahit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaksi" ADD CONSTRAINT "Transaksi_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ModelBaju"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaksi" ADD CONSTRAINT "Transaksi_warnaId_fkey" FOREIGN KEY ("warnaId") REFERENCES "Warna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransaksiItem" ADD CONSTRAINT "TransaksiItem_transaksiId_fkey" FOREIGN KEY ("transaksiId") REFERENCES "Transaksi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
