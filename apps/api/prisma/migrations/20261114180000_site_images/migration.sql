-- Tasarım görselleri (footer zemini, ürün bandı zemini, ürün tabağı, ikon dokusu) admin'den yönetilir.
-- Boş nesne = mağaza kendi varsayılan görsellerini kullanır (bugünkü görünüm değişmez).
ALTER TABLE "SiteTheme" ADD COLUMN "siteImages" JSONB NOT NULL DEFAULT '{}';
