-- İletişim ve S.S.S. sayfası ayarları (JSON; boş = varsayılan metinler)
ALTER TABLE "SiteTheme" ADD COLUMN "contactPage" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "SiteTheme" ADD COLUMN "faqPage" JSONB NOT NULL DEFAULT '{}';
