-- ───────────── Kategori ─────────────
ALTER TABLE "Category" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "metaTitle" TEXT,
ADD COLUMN "metaDescription" TEXT;

DROP INDEX "Category_isActive_idx";
DROP INDEX "Category_deletedAt_idx";
CREATE INDEX "Category_isActive_deletedAt_order_idx" ON "Category"("isActive", "deletedAt", "order");

-- ───────────── Ürün ─────────────
ALTER TABLE "Product" ALTER COLUMN "description" DROP NOT NULL,
ADD COLUMN "summary" TEXT,
ADD COLUMN "compareAtPrice" DECIMAL(10,2),
ADD COLUMN "unit" TEXT,
ADD COLUMN "trackStock" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "metaTitle" TEXT,
ADD COLUMN "metaDescription" TEXT;

-- CreateTable
CREATE TABLE "ProductTab" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductTab_pkey" PRIMARY KEY ("id")
);

-- Mevcut veriyi koru: story / features / servingSuggestion → sekmeler
INSERT INTO "ProductTab" ("id", "productId", "title", "body", "order")
SELECT gen_random_uuid()::text, "id", 'Hikaye', "story", 0 FROM "Product" WHERE coalesce(trim("story"), '') <> '';
INSERT INTO "ProductTab" ("id", "productId", "title", "body", "order")
SELECT gen_random_uuid()::text, "id", 'Özellikler', "features", 1 FROM "Product" WHERE coalesce(trim("features"), '') <> '';
INSERT INTO "ProductTab" ("id", "productId", "title", "body", "order")
SELECT gen_random_uuid()::text, "id", 'Nasıl Servis Edilir?', "servingSuggestion", 2 FROM "Product" WHERE coalesce(trim("servingSuggestion"), '') <> '';

ALTER TABLE "Product" DROP COLUMN "story",
DROP COLUMN "features",
DROP COLUMN "servingSuggestion";

DROP INDEX "Product_isActive_idx";
DROP INDEX "Product_isActive_categoryId_idx";
DROP INDEX "Product_deletedAt_idx";
CREATE INDEX "Product_isActive_deletedAt_categoryId_idx" ON "Product"("isActive", "deletedAt", "categoryId");
CREATE INDEX "Product_isActive_deletedAt_featured_idx" ON "Product"("isActive", "deletedAt", "featured");
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");
CREATE INDEX "Product_price_idx" ON "Product"("price");

-- ───────────── Görseller ─────────────
DROP INDEX "ProductImage_productId_idx";
CREATE INDEX "ProductImage_productId_order_idx" ON "ProductImage"("productId", "order");

CREATE INDEX "ProductTab_productId_order_idx" ON "ProductTab"("productId", "order");
ALTER TABLE "ProductTab" ADD CONSTRAINT "ProductTab_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ───────────── Medya kütüphanesi ─────────────
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Media_storageKey_key" ON "Media"("storageKey");
CREATE UNIQUE INDEX "Media_url_key" ON "Media"("url");
CREATE INDEX "Media_createdAt_idx" ON "Media"("createdAt");
