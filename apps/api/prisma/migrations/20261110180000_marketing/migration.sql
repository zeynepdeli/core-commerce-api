-- Pazarlama: stok bildirimi, sepet hatırlatma, Google Merchant akışı
ALTER TABLE "StoreSettings" ADD COLUMN "abandonedCartEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StoreSettings" ADD COLUMN "abandonedCartDelayHours" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "StoreSettings" ADD COLUMN "productFeedEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StoreSettings" ADD COLUMN "feedBrand" TEXT;
ALTER TABLE "StoreSettings" ADD CONSTRAINT "StoreSettings_abandonedCartDelayHours_check" CHECK ("abandonedCartDelayHours" BETWEEN 1 AND 72);
ALTER TABLE "Cart" ADD COLUMN "reminderSentAt" TIMESTAMP(3);
-- Hatırlatma işi: üye sepetleri, son güncellemeye göre
CREATE INDEX "Cart_member_updatedAt_idx" ON "Cart"("updatedAt") WHERE "userId" IS NOT NULL;

CREATE TABLE "StockAlert" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),
    CONSTRAINT "StockAlert_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StockAlert_variantId_email_key" ON "StockAlert"("variantId", "email");
CREATE INDEX "StockAlert_notifiedAt_variantId_idx" ON "StockAlert"("notifiedAt", "variantId");
CREATE INDEX "StockAlert_email_idx" ON "StockAlert"("email");
ALTER TABLE "StockAlert" ADD CONSTRAINT "StockAlert_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MarketingMessage" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "refId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketingMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MarketingMessage_type_sentAt_idx" ON "MarketingMessage"("type", "sentAt");
CREATE INDEX "MarketingMessage_userId_sentAt_idx" ON "MarketingMessage"("userId", "sentAt");
