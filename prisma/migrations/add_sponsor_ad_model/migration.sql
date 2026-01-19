-- CreateTable
CREATE TABLE "SponsorAd" (
    "id" TEXT NOT NULL,
    "sponsorBacklink" TEXT NOT NULL,
    "sponsorAdImage" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'inactive',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SponsorAd_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SponsorAd_status_idx" ON "SponsorAd"("status");

-- CreateIndex
CREATE INDEX "SponsorAd_createdAt_idx" ON "SponsorAd"("createdAt");
