-- DropForeignKey
ALTER TABLE "ModelBaju" DROP CONSTRAINT "ModelBaju_bossId_fkey";

-- DropIndex
DROP INDEX "ModelBaju_bossId_nama_key";

-- AlterTable
ALTER TABLE "ModelBaju" DROP COLUMN "bossId",
ADD COLUMN     "pemilikId" INTEGER NOT NULL;

-- DropTable
DROP TABLE "Boss";

-- CreateTable
CREATE TABLE "Pemilik" (
    "id" SERIAL NOT NULL,
    "nama" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Pemilik_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Pemilik_nama_key" ON "Pemilik"("nama");

-- CreateIndex
CREATE UNIQUE INDEX "ModelBaju_pemilikId_nama_key" ON "ModelBaju"("pemilikId", "nama");

-- AddForeignKey
ALTER TABLE "ModelBaju" ADD CONSTRAINT "ModelBaju_pemilikId_fkey" FOREIGN KEY ("pemilikId") REFERENCES "Pemilik"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

