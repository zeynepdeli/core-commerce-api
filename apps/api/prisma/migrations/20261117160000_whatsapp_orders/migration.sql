-- Sipariş kanalı: online ödeme (varsayılan) ya da WhatsApp talebi
CREATE TYPE "OrderChannel" AS ENUM ('ONLINE_PAYMENT', 'WHATSAPP');

ALTER TABLE "StoreSettings" ADD COLUMN "orderChannel" "OrderChannel" NOT NULL DEFAULT 'ONLINE_PAYMENT';
ALTER TABLE "StoreSettings" ADD COLUMN "whatsappOrderPhone" TEXT;
ALTER TABLE "StoreSettings" ADD COLUMN "whatsappHoldHours" INTEGER NOT NULL DEFAULT 48;
