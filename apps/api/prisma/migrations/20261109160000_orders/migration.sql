-- ───────────── Sipariş ─────────────
-- Not: sipariş özelliği bu sürüme kadar yazılmamıştı; yine de olası satırlar
-- bozulmasın diye zorunlu kolonlar geçici varsayılanla eklenip sonra varsayılan kaldırılır.
ALTER TABLE "Order" DROP CONSTRAINT "Order_userId_fkey";
ALTER TABLE "Order" DROP CONSTRAINT "Order_addressId_fkey";
DROP INDEX "Order_userId_idx";
DROP INDEX "Order_addressId_idx";
DROP INDEX "Order_status_idx";
DROP INDEX "Order_orderNumber_idx";

ALTER TABLE "Order" ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "addressId" DROP NOT NULL,
ADD COLUMN "email" TEXT NOT NULL DEFAULT '',
ADD COLUMN "phone" TEXT NOT NULL DEFAULT '',
ADD COLUMN "shippingAddress" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "billingInfo" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "shippingFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "vatTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "couponCode" TEXT,
ADD COLUMN "customerNote" TEXT,
ADD COLUMN "idempotencyKey" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
ADD COLUMN "guestAccessTokenHash" TEXT,
ADD COLUMN "paymentDueAt" TIMESTAMP(3),
ADD COLUMN "sourceCartId" TEXT,
ADD COLUMN "shippingCarrier" TEXT,
ADD COLUMN "trackingNumber" TEXT,
ADD COLUMN "shippedAt" TIMESTAMP(3),
ADD COLUMN "deliveredAt" TIMESTAMP(3),
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "cancelReason" TEXT;

ALTER TABLE "Order" ALTER COLUMN "email" DROP DEFAULT,
ALTER COLUMN "phone" DROP DEFAULT,
ALTER COLUMN "shippingAddress" DROP DEFAULT,
ALTER COLUMN "billingInfo" DROP DEFAULT,
ALTER COLUMN "subtotal" DROP DEFAULT,
ALTER COLUMN "idempotencyKey" DROP DEFAULT;

CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");
CREATE UNIQUE INDEX "Order_guestAccessTokenHash_key" ON "Order"("guestAccessTokenHash");
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
CREATE INDEX "Order_email_idx" ON "Order"("email");
CREATE INDEX "Order_status_paymentDueAt_idx" ON "Order"("status", "paymentDueAt");
CREATE INDEX "Order_sourceCartId_status_idx" ON "Order"("sourceCartId", "status");
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Sipariş zaman çizelgesi
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "note" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ───────────── Yasal metinler & onaylar ─────────────
CREATE TYPE "LegalDocumentType" AS ENUM ('PRE_INFORMATION', 'DISTANCE_SALES', 'KVKK_NOTICE');

CREATE TABLE "LegalDocument" (
    "id" TEXT NOT NULL,
    "type" "LegalDocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LegalDocument_type_key" ON "LegalDocument"("type");

CREATE TABLE "AgreementAcceptance" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" "LegalDocumentType" NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgreementAcceptance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AgreementAcceptance_orderId_type_key" ON "AgreementAcceptance"("orderId", "type");
ALTER TABLE "AgreementAcceptance" ADD CONSTRAINT "AgreementAcceptance_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "ConsentChannel" AS ENUM ('EMAIL', 'SMS');

CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "channel" "ConsentChannel" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ConsentRecord_email_channel_createdAt_idx" ON "ConsentRecord"("email", "channel", "createdAt");
CREATE INDEX "ConsentRecord_userId_idx" ON "ConsentRecord"("userId");

-- ───────────── Kupon kullanımı ─────────────
CREATE TABLE "CouponRedemption" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CouponRedemption_orderId_key" ON "CouponRedemption"("orderId");
CREATE INDEX "CouponRedemption_couponId_userId_idx" ON "CouponRedemption"("couponId", "userId");
CREATE INDEX "CouponRedemption_couponId_email_idx" ON "CouponRedemption"("couponId", "email");
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ───────────── Mağaza ayarları: satıcı bilgileri ─────────────
ALTER TABLE "StoreSettings" ADD COLUMN "paymentTimeoutMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN "sellerName" TEXT,
ADD COLUMN "sellerAddress" TEXT,
ADD COLUMN "sellerPhone" TEXT,
ADD COLUMN "sellerEmail" TEXT,
ADD COLUMN "sellerTaxOffice" TEXT,
ADD COLUMN "sellerTaxNumber" TEXT,
ADD COLUMN "sellerMersisNo" TEXT;
