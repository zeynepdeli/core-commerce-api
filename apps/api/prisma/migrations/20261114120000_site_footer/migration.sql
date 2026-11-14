-- Alt bilgi (footer) ayrı tabloya taşınır; admin'de kendi sayfasından düzenlenir.
CREATE TABLE "SiteFooter" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "socialLinks" JSONB NOT NULL DEFAULT '[]',
    "pagesTitle" TEXT NOT NULL DEFAULT 'Kurumsal',
    "contactTitle" TEXT NOT NULL DEFAULT 'İletişim',
    "showCampaign" BOOLEAN NOT NULL DEFAULT true,
    "campaignTitle" TEXT NOT NULL DEFAULT 'Kampanyalar',
    "campaignText" TEXT DEFAULT 'Kampanya ve indirimlerden ilk siz haberdar olun.',
    "campaignButtonLabel" TEXT NOT NULL DEFAULT 'Üye Ol',
    "campaignButtonLink" TEXT NOT NULL DEFAULT '/kayit',
    "copyrightText" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SiteFooter_pkey" PRIMARY KEY ("id")
);

-- Mevcut verileri taşı:
--   * Footer metni = şimdiye kadar footer'da görünen SEO açıklaması (görünüm değişmesin)
--   * { "instagram": "https://…" } → [{ "icon": "instagram", "label": "Instagram", "url": "https://…" }]
--     LinkedIn'in hazır ikonu yok: genel "web" ikonuyla taşınır (yönetici dilerse siler).
-- SiteTheme satırı yoksa hiçbir şey eklenmez; API ilk okumada varsayılanlarla oluşturur.
INSERT INTO "SiteFooter" ("id", "description", "socialLinks", "updatedAt")
SELECT
    1,
    t."metaDescription",
    COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'icon', CASE WHEN e.key = 'linkedin' THEN 'web' ELSE e.key END,
                    'label', CASE e.key
                        WHEN 'instagram' THEN 'Instagram'
                        WHEN 'facebook' THEN 'Facebook'
                        WHEN 'x' THEN 'X'
                        WHEN 'youtube' THEN 'YouTube'
                        WHEN 'tiktok' THEN 'TikTok'
                        WHEN 'pinterest' THEN 'Pinterest'
                        WHEN 'linkedin' THEN 'LinkedIn'
                        ELSE e.key
                    END,
                    'url', e.value
                )
                ORDER BY e.key
            )
            FROM jsonb_each_text(t."socialLinks") AS e
            WHERE e.value <> ''
        ),
        '[]'::jsonb
    ),
    CURRENT_TIMESTAMP
FROM "SiteTheme" AS t
WHERE t."id" = 1;

ALTER TABLE "SiteTheme" DROP COLUMN "socialLinks";
