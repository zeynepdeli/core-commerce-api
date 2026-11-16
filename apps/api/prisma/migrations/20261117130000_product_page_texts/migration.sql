-- Ürün detay sayfası yazıları (etiket, düğmeler, miktar). Görseller SiteTheme.siteImages'ta.
ALTER TABLE "SiteTheme" ADD COLUMN "productLabelText" TEXT NOT NULL DEFAULT 'Özel Lezzet';
ALTER TABLE "SiteTheme" ADD COLUMN "addToCartText" TEXT NOT NULL DEFAULT 'Sepete Ekle';
ALTER TABLE "SiteTheme" ADD COLUMN "buyNowText" TEXT NOT NULL DEFAULT 'Hemen Al';
ALTER TABLE "SiteTheme" ADD COLUMN "quantityText" TEXT NOT NULL DEFAULT 'Miktar';
