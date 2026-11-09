-- Şifre değişince eski erişim token'ları geçersiz sayılsın
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
