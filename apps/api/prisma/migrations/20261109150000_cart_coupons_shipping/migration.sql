-- ───────────── Sepet: misafir sepeti + kupon ─────────────
ALTER TABLE "Cart" ALTER COLUMN "userId" DROP NOT NULL,
ADD COLUMN "guestTokenHash" TEXT,
ADD COLUMN "expiresAt" TIMESTAMP(3),
ADD COLUMN "couponCode" TEXT;
CREATE UNIQUE INDEX "Cart_guestTokenHash_key" ON "Cart"("guestTokenHash");
CREATE INDEX "Cart_expiresAt_idx" ON "Cart"("expiresAt");
-- Sepet ya üyeye ya misafire aittir (ikisi birden/hiçbiri olamaz)
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_owner_check" CHECK (("userId" IS NULL) <> ("guestTokenHash" IS NULL));

-- ───────────── Mağaza ayarları ─────────────
CREATE TABLE "StoreSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "shippingFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "freeShippingThreshold" DECIMAL(10,2),
    "minOrderAmount" DECIMAL(10,2),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);

-- ───────────── Kupon ─────────────
CREATE TYPE "CouponType" AS ENUM ('PERCENT', 'FIXED', 'FREE_SHIPPING');

CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "CouponType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "maxDiscount" DECIMAL(10,2),
    "minSubtotal" DECIMAL(10,2),
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "usageLimit" INTEGER,
    "perUserLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");
CREATE INDEX "Coupon_isActive_endsAt_idx" ON "Coupon"("isActive", "endsAt");
