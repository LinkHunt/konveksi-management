-- CreateEnum
CREATE TYPE "AksiRiwayat" AS ENUM ('BUAT', 'UBAH', 'HAPUS');

-- CreateTable
CREATE TABLE "HasilPotong" (
    "id" SERIAL NOT NULL,
    "modelId" INTEGER NOT NULL,
    "warnaId" INTEGER NOT NULL,
    "ukuran" "Ukuran" NOT NULL,
    "jumlah" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HasilPotong_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HasilPotongRiwayat" (
    "id" SERIAL NOT NULL,
    "hasilPotongId" INTEGER NOT NULL,
    "aksi" "AksiRiwayat" NOT NULL,
    "modelId" INTEGER NOT NULL,
    "warnaId" INTEGER NOT NULL,
    "ukuran" "Ukuran" NOT NULL,
    "jumlahLama" INTEGER,
    "jumlahBaru" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HasilPotongRiwayat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setoran" (
    "id" SERIAL NOT NULL,
    "tanggal" DATE NOT NULL,
    "catatan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setoran_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetoranItem" (
    "id" SERIAL NOT NULL,
    "setoranId" INTEGER NOT NULL,
    "modelId" INTEGER NOT NULL,
    "warnaId" INTEGER NOT NULL,
    "ukuran" "Ukuran" NOT NULL,
    "jumlah" INTEGER NOT NULL,

    CONSTRAINT "SetoranItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HasilPotong_warnaId_idx" ON "HasilPotong"("warnaId");

-- CreateIndex
CREATE UNIQUE INDEX "HasilPotong_modelId_warnaId_ukuran_key" ON "HasilPotong"("modelId", "warnaId", "ukuran");

-- CreateIndex
CREATE INDEX "HasilPotongRiwayat_hasilPotongId_idx" ON "HasilPotongRiwayat"("hasilPotongId");

-- CreateIndex
CREATE INDEX "HasilPotongRiwayat_modelId_warnaId_ukuran_idx" ON "HasilPotongRiwayat"("modelId", "warnaId", "ukuran");

-- CreateIndex
CREATE INDEX "Setoran_tanggal_idx" ON "Setoran"("tanggal");

-- CreateIndex
CREATE INDEX "SetoranItem_modelId_warnaId_ukuran_idx" ON "SetoranItem"("modelId", "warnaId", "ukuran");

-- CreateIndex
CREATE UNIQUE INDEX "SetoranItem_setoranId_modelId_warnaId_ukuran_key" ON "SetoranItem"("setoranId", "modelId", "warnaId", "ukuran");

-- AddForeignKey
ALTER TABLE "HasilPotong" ADD CONSTRAINT "HasilPotong_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ModelBaju"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HasilPotong" ADD CONSTRAINT "HasilPotong_warnaId_fkey" FOREIGN KEY ("warnaId") REFERENCES "Warna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HasilPotongRiwayat" ADD CONSTRAINT "HasilPotongRiwayat_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ModelBaju"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HasilPotongRiwayat" ADD CONSTRAINT "HasilPotongRiwayat_warnaId_fkey" FOREIGN KEY ("warnaId") REFERENCES "Warna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetoranItem" ADD CONSTRAINT "SetoranItem_setoranId_fkey" FOREIGN KEY ("setoranId") REFERENCES "Setoran"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetoranItem" ADD CONSTRAINT "SetoranItem_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ModelBaju"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetoranItem" ADD CONSTRAINT "SetoranItem_warnaId_fkey" FOREIGN KEY ("warnaId") REFERENCES "Warna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

