/*
  Warnings:

  - You are about to drop the column `mainImageAssetId` on the `Project` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_mainImageAssetId_fkey";

-- DropIndex
DROP INDEX "Project_mainImageAssetId_key";

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "mainImageAssetId",
ADD COLUMN     "mainImage" TEXT,
ALTER COLUMN "targetMarketplace" SET DEFAULT 'OTHER',
ALTER COLUMN "brandFontHeading" SET DEFAULT 'Montserrat',
ALTER COLUMN "brandFontSubheading" SET DEFAULT 'Open Sans';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'USER';
