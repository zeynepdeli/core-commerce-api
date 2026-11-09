-- Ödeme: sağlayıcı oturum kimliği, token özeti, deneme zamanı
ALTER TABLE "Payment" ADD COLUMN "conversationId" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
ADD COLUMN "tokenHash" TEXT,
ADD COLUMN "initiatedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ALTER COLUMN "conversationId" DROP DEFAULT;
CREATE UNIQUE INDEX "Payment_conversationId_key" ON "Payment"("conversationId");
CREATE UNIQUE INDEX "Payment_tokenHash_key" ON "Payment"("tokenHash");
