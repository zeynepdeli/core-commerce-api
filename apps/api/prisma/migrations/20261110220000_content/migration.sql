-- İçerik: görünüm ayarları genişletildi, bilgi sayfaları
ALTER TABLE "SiteTheme" ADD COLUMN "announcementText" TEXT;
ALTER TABLE "SiteTheme" ADD COLUMN "announcementLink" TEXT;
ALTER TABLE "SiteTheme" ADD COLUMN "contactEmail" TEXT;
ALTER TABLE "SiteTheme" ADD COLUMN "contactPhone" TEXT;
ALTER TABLE "SiteTheme" ADD COLUMN "contactWhatsapp" TEXT;
ALTER TABLE "SiteTheme" ADD COLUMN "contactAddress" TEXT;
ALTER TABLE "SiteTheme" ADD COLUMN "workingHours" TEXT;
ALTER TABLE "SiteTheme" ADD COLUMN "socialLinks" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "SiteTheme" ADD COLUMN "metaTitle" TEXT;
ALTER TABLE "SiteTheme" ADD COLUMN "metaDescription" TEXT;
ALTER TABLE "SiteTheme" ADD COLUMN "ogImageUrl" TEXT;

CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "showInFooter" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Page_slug_key" ON "Page"("slug");
CREATE INDEX "Page_isPublished_order_idx" ON "Page"("isPublished", "order");
