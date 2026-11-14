-- Header menü linkleri (eski sitedeki gibi admin'den yönetilir).
-- Boş liste = mağaza menüde kategorileri gösterir (bugünkü davranış değişmez).
ALTER TABLE "SiteTheme" ADD COLUMN "headerLinks" JSONB NOT NULL DEFAULT '[]';
