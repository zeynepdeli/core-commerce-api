-- Yorumlar: onay durumu, doğrulanmış alıcı, başlık, mağaza yanıtı; ürün puan özeti
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "Review" ADD COLUMN "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING';
UPDATE "Review" SET "status" = 'APPROVED' WHERE "isApproved" = true;
DROP INDEX IF EXISTS "Review_productId_isApproved_idx";
ALTER TABLE "Review" DROP COLUMN "isApproved";
ALTER TABLE "Review" ADD COLUMN "orderId" TEXT;
ALTER TABLE "Review" ADD COLUMN "title" TEXT;
ALTER TABLE "Review" ADD COLUMN "rejectReason" TEXT;
ALTER TABLE "Review" ADD COLUMN "adminReply" TEXT;
ALTER TABLE "Review" ADD COLUMN "adminReplyAt" TIMESTAMP(3);
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_check" CHECK ("rating" BETWEEN 1 AND 5);
CREATE INDEX "Review_productId_status_createdAt_idx" ON "Review"("productId", "status", "createdAt");
CREATE INDEX "Review_status_createdAt_idx" ON "Review"("status", "createdAt");

ALTER TABLE "Product" ADD COLUMN "ratingAvg" DECIMAL(3,2) NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN "ratingCount" INTEGER NOT NULL DEFAULT 0;
UPDATE "Product" p SET "ratingCount" = s.n, "ratingAvg" = s.avg
FROM (SELECT "productId", count(*)::int AS n, round(avg(rating)::numeric, 2) AS avg FROM "Review" WHERE status = 'APPROVED' GROUP BY "productId") s
WHERE s."productId" = p.id;

ALTER TABLE "StoreSettings" ADD COLUMN "reviewAutoApprove" BOOLEAN NOT NULL DEFAULT false;
