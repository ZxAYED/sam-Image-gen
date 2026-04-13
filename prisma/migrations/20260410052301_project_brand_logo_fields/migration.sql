/*
  Warnings:

  - Added the required column `productTitle` to the `Project` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_brandLogoAssetId_fkey";

-- AlterTable
ALTER TABLE "Image1" ADD COLUMN     "sourceImageUrl" TEXT,
ALTER COLUMN "generationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "brandLogoInfoId" UUID,
ADD COLUMN     "downloadImageFormat" TEXT,
ADD COLUMN     "optimizeKeywordsAmazon" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "optimizeKeywordsGoogle" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "productTitle" TEXT NOT NULL,
ADD COLUMN     "selectedLanguages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "usps" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "brandLogoAssetId" SET DATA TYPE TEXT;

-- CreateIndex
CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_brandLogoInfoId_fkey" FOREIGN KEY ("brandLogoInfoId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
