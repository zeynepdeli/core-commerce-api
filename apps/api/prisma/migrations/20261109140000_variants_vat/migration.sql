-- ───────────── Varyantlar ─────────────
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "compareAtPrice" DECIMAL(10,2),
    "stock" INTEGER NOT NULL DEFAULT 0,
    "trackStock" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- Mevcut veriyi koru: her ürünün fiyat/stok/SKU/birim bilgisi tek bir varyanta taşınır
INSERT INTO "ProductVariant" ("id", "productId", "name", "sku", "price", "compareAtPrice", "stock", "trackStock", "isActive", "order", "deletedAt", "updatedAt")
SELECT gen_random_uuid()::text, "id", coalesce(nullif(trim("unit"), ''), 'Standart'), "sku", "price", "compareAtPrice", "stock", "trackStock", true, 0, "deletedAt", CURRENT_TIMESTAMP
FROM "Product";

CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");
CREATE INDEX "ProductVariant_productId_deletedAt_order_idx" ON "ProductVariant"("productId", "deletedAt", "order");
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ürün: fiyat artık varyantlardan hesaplanan "…'den başlayan" fiyat; KDV oranı eklendi
DROP INDEX "Product_sku_key";
ALTER TABLE "Product" DROP COLUMN "sku",
DROP COLUMN "stock",
DROP COLUMN "trackStock",
DROP COLUMN "unit",
ADD COLUMN "vatRate" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "Product" ADD CONSTRAINT "Product_vatRate_check" CHECK ("vatRate" IN (0, 1, 10, 20));

-- ───────────── Sepet: ürün yerine varyant ─────────────
-- (Sepet özelliği henüz yazılmadı; eski satırlar varyanta eşlenir)
ALTER TABLE "CartItem" ADD COLUMN "variantId" TEXT;
UPDATE "CartItem" c SET "variantId" = v."id"
FROM "ProductVariant" v WHERE v."productId" = c."productId";
DELETE FROM "CartItem" WHERE "variantId" IS NULL;
ALTER TABLE "CartItem" ALTER COLUMN "variantId" SET NOT NULL;
ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_productId_fkey";
DROP INDEX "CartItem_cartId_productId_key";
DROP INDEX "CartItem_productId_idx";
ALTER TABLE "CartItem" DROP COLUMN "productId";
CREATE UNIQUE INDEX "CartItem_cartId_variantId_key" ON "CartItem"("cartId", "variantId");
CREATE INDEX "CartItem_variantId_idx" ON "CartItem"("variantId");
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ───────────── Sipariş satırı: varyant + anlık görüntü ─────────────
-- (Sipariş özelliği henüz yazılmadı; eski satırlar varsa ürünün varyantına eşlenir)
ALTER TABLE "OrderItem" ADD COLUMN "variantId" TEXT,
ADD COLUMN "variantName" TEXT,
ADD COLUMN "vatRate" INTEGER;
UPDATE "OrderItem" o SET "variantId" = v."id", "variantName" = v."name", "vatRate" = 20
FROM "ProductVariant" v WHERE v."productId" = o."productId";
ALTER TABLE "OrderItem" ALTER COLUMN "variantId" SET NOT NULL,
ALTER COLUMN "variantName" SET NOT NULL,
ALTER COLUMN "vatRate" SET NOT NULL;
CREATE INDEX "OrderItem_variantId_idx" ON "OrderItem"("variantId");
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
