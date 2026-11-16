-- Kampanyalar sayfası: kampanya kartları ve sayfa yazıları
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "badge" TEXT,
    "imageUrl" TEXT,
    "couponCode" TEXT,
    "linkUrl" TEXT,
    "linkLabel" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Campaign_isActive_order_idx" ON "Campaign"("isActive", "order");

ALTER TABLE "SiteTheme" ADD COLUMN "campaignPage" JSONB NOT NULL DEFAULT '{}';
