-- Satış raporları: ödeme / iptal / iade tarihine göre aralık sorguları
CREATE INDEX "Order_paidAt_idx" ON "Order"("paidAt") WHERE "paidAt" IS NOT NULL;
CREATE INDEX "Order_cancelledAt_paid_idx" ON "Order"("cancelledAt") WHERE "cancelledAt" IS NOT NULL AND "paidAt" IS NOT NULL;
CREATE INDEX "ReturnRequest_refundedAt_idx" ON "ReturnRequest"("refundedAt") WHERE "refundedAt" IS NOT NULL;
