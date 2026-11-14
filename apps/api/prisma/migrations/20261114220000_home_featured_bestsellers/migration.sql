-- Eski enfesGurme ana sayfasındaki iki bölüm: slider'ın içindeki "Günün Öne Çıkanları" kartları ve
-- altındaki "En Çok Satanlar" bandı. Ana sayfada yoksa eklenir (admin'de Ana Sayfa Düzeni'nde görünür,
-- düzenlenir, kapatılır). Zaten aynı kaynaktan bir ürün listesi varsa hiçbir şey eklenmez.

-- Slider'dan sonraki bölümleri iki sıra aşağı kaydır (yeni bölümler slider'ın hemen altına girsin)
UPDATE "ContentBlock" b
SET "order" = b."order" + 2
WHERE b.page = 'home'
  AND EXISTS (SELECT 1 FROM "ContentBlock" h WHERE h.page = 'home' AND h.data->>'type' = 'HERO' AND b."order" > h."order")
  AND NOT EXISTS (SELECT 1 FROM "ContentBlock" x WHERE x.page = 'home' AND x.data->>'type' = 'PRODUCT_LIST' AND x.data->>'source' IN ('featured', 'bestsellers'));

-- Ekleme sırası: ilk slider'ın hemen altı; slider yoksa en son
INSERT INTO "ContentBlock" (id, page, key, data, "order", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'home', 'one-cikanlar',
       '{"type":"PRODUCT_LIST","title":"Günün Öne Çıkanları","source":"featured","limit":4,"display":"hero","cardButtonLabel":"Keşfet"}'::jsonb,
       COALESCE((SELECT MIN("order") FROM "ContentBlock" WHERE page = 'home' AND data->>'type' = 'HERO') + 1,
                (SELECT COALESCE(MAX("order"), -1) + 1 FROM "ContentBlock" WHERE page = 'home')),
       true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "ContentBlock" WHERE page = 'home' AND (key = 'one-cikanlar' OR (data->>'type' = 'PRODUCT_LIST' AND data->>'source' = 'featured')));

INSERT INTO "ContentBlock" (id, page, key, data, "order", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'home', 'en-cok-satanlar',
       '{"type":"PRODUCT_LIST","title":"En Çok Satanlar","source":"bestsellers","limit":4,"display":"band","cardButtonLabel":"Sepete Ekle"}'::jsonb,
       COALESCE((SELECT MIN("order") FROM "ContentBlock" WHERE page = 'home' AND data->>'type' = 'HERO') + 2,
                (SELECT COALESCE(MAX("order"), -1) + 1 FROM "ContentBlock" WHERE page = 'home')),
       true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "ContentBlock" WHERE page = 'home' AND (key = 'en-cok-satanlar' OR (data->>'type' = 'PRODUCT_LIST' AND data->>'source' = 'bestsellers')));
