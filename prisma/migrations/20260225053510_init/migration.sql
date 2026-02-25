-- CreateEnum
CREATE TYPE "Marketplace" AS ENUM ('AMAZON', 'EBAY', 'SHOPIFY', 'ETSY', 'WALMART', 'OTHER');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ImageSlotType" AS ENUM ('MAIN_PRODUCT', 'KEY_FACTS', 'LIFESTYLE', 'USP_HIGHLIGHT', 'COMPARISON', 'CROSS_SELLING', 'CLOSING');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "productCategory" TEXT NOT NULL,
    "targetMarketplace" "Marketplace" NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "mainImageAssetId" UUID,
    "brandLogoAssetId" UUID,
    "sku" TEXT,
    "shortDescription" TEXT,
    "brandFontHeading" TEXT NOT NULL,
    "brandFontSubheading" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "imagesCreated" INTEGER NOT NULL DEFAULT 0,
    "productsOptimized" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileName" TEXT,
    "sizeBytes" INTEGER,
    "storageKey" TEXT NOT NULL,
    "publicUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Image1" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "refinePrompt" TEXT,
    "generatedPrompt" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "requirement" TEXT NOT NULL DEFAULT 'Pure white background (FFFFFF), Product centered and fits 85% of frame, No text or additional graphics, High resolution (minimum 1000px)',
    "imageUrl" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Image1_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Image2" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "refinePrompt" TEXT,
    "generatedPrompt" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "backgroundStyle" TEXT,
    "brandLogoPosition" TEXT,
    "keyFact1" TEXT,
    "keyFact2" TEXT,
    "keyFact3" TEXT,
    "keyFact4" TEXT,
    "imageUrl" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Image2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Image3" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "refinePrompt" TEXT,
    "generatedPrompt" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "lifestyleImageAssetId" UUID,
    "usageScenarioDescription" TEXT,
    "lifestyleProviderImage" TEXT,
    "lifestyleGeneratedImage" TEXT,
    "imageUrl" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Image3_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Image4" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "refinePrompt" TEXT,
    "generatedPrompt" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "uspHighlight1" TEXT,
    "uspHighlight2" TEXT,
    "uspHighlight3" TEXT,
    "uspHighlight4" TEXT,
    "imageUrl" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Image4_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Image5" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "refinePrompt" TEXT,
    "generatedPrompt" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "comparisonAdv1" TEXT,
    "comparisonAdv2" TEXT,
    "comparisonAdv3" TEXT,
    "comparisonLim1" TEXT,
    "comparisonLim2" TEXT,
    "comparisonLim3" TEXT,
    "imageUrl" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Image5_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Image6" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "refinePrompt" TEXT,
    "generatedPrompt" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "crossSellProduct1" TEXT,
    "crossSellProduct2" TEXT,
    "crossSellProduct3" TEXT,
    "crossSellProduct4" TEXT,
    "crossSellProduct5" TEXT,
    "crossSellProduct6" TEXT,
    "imageUrl" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Image6_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Image7" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "refinePrompt" TEXT,
    "generatedPrompt" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "emotionDirection" TEXT,
    "customHeadline" TEXT,
    "imageUrl" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Image7_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectStats" (
    "projectId" UUID NOT NULL,
    "imagesCreated" INTEGER NOT NULL DEFAULT 0,
    "productsOptimized" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectStats_pkey" PRIMARY KEY ("projectId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Project_mainImageAssetId_key" ON "Project"("mainImageAssetId");

-- CreateIndex
CREATE INDEX "Project_name_idx" ON "Project"("name");

-- CreateIndex
CREATE INDEX "Project_brandName_idx" ON "Project"("brandName");

-- CreateIndex
CREATE INDEX "Project_productCategory_idx" ON "Project"("productCategory");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_storageKey_key" ON "Asset"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "Image1_generationId_key" ON "Image1"("generationId");

-- CreateIndex
CREATE UNIQUE INDEX "Image2_generationId_key" ON "Image2"("generationId");

-- CreateIndex
CREATE UNIQUE INDEX "Image3_generationId_key" ON "Image3"("generationId");

-- CreateIndex
CREATE UNIQUE INDEX "Image4_generationId_key" ON "Image4"("generationId");

-- CreateIndex
CREATE UNIQUE INDEX "Image5_generationId_key" ON "Image5"("generationId");

-- CreateIndex
CREATE UNIQUE INDEX "Image6_generationId_key" ON "Image6"("generationId");

-- CreateIndex
CREATE UNIQUE INDEX "Image7_generationId_key" ON "Image7"("generationId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_mainImageAssetId_fkey" FOREIGN KEY ("mainImageAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_brandLogoAssetId_fkey" FOREIGN KEY ("brandLogoAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Image1" ADD CONSTRAINT "Image1_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Image2" ADD CONSTRAINT "Image2_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Image3" ADD CONSTRAINT "Image3_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Image3" ADD CONSTRAINT "Image3_lifestyleImageAssetId_fkey" FOREIGN KEY ("lifestyleImageAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Image4" ADD CONSTRAINT "Image4_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Image5" ADD CONSTRAINT "Image5_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Image6" ADD CONSTRAINT "Image6_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Image7" ADD CONSTRAINT "Image7_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStats" ADD CONSTRAINT "ProjectStats_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
