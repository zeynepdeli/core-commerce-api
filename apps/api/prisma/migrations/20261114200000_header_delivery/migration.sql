-- Header teslimat kutusu ve metinleri admin'den yönetilir (eski enfesGurme'deki SiteHeader alanları).
-- Varsayılanlar mağazada bugün görünen metinlerle aynı: görünüm değişmez.
ALTER TABLE "SiteTheme"
  ADD COLUMN "showDelivery" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "deliveryTitle" TEXT NOT NULL DEFAULT 'Teslimat Adresi',
  ADD COLUMN "deliveryText" TEXT NOT NULL DEFAULT 'Konum Seçin',
  ADD COLUMN "deliveryLink" TEXT NOT NULL DEFAULT '/hesabim/adresler',
  ADD COLUMN "deliveryIconUrl" TEXT,
  ADD COLUMN "searchPlaceholder" TEXT NOT NULL DEFAULT 'Ürün ara...',
  ADD COLUMN "loginText" TEXT NOT NULL DEFAULT 'Giriş Yap',
  ADD COLUMN "accountText" TEXT NOT NULL DEFAULT 'Hesabım',
  ADD COLUMN "cartText" TEXT NOT NULL DEFAULT 'Sepetim';
