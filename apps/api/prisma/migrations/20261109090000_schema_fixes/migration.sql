-- İptal edilmemiş refresh token'lar kaydedilebilsin (revokedAt boş = geçerli)
ALTER TABLE "RefreshToken" ALTER COLUMN "revokedAt" DROP NOT NULL;

-- Yazım hataları
ALTER TYPE "OrderStatus" RENAME VALUE 'CANCALLED' TO 'CANCELLED';
ALTER TYPE "PaymentStatus" RENAME VALUE 'REFUNED' TO 'REFUNDED';
