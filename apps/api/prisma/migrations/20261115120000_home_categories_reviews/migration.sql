-- Eski enfesGurme ana sayfasındaki iki bölüm: "Kategoriler" (kemerli kapı içinde video + kategori kartları)
-- ve "Müşterilerimizin Kalbinden" (yorum kartları). Ana sayfada yoksa "En Çok Satanlar"ın hemen altına
-- (o yoksa en sona) eklenir. Aynı tipte bölüm zaten varsa eklenmez; tekrar çalışması güvenlidir.
-- Yorum kartları boş eklenir (sahte yorum yok): admin'den eklenene kadar mağazada görünmez.
DO $$
DECLARE
  anchor INT;
  need_categories BOOLEAN := NOT EXISTS (SELECT 1 FROM "ContentBlock" WHERE page = 'home' AND data->>'type' = 'CATEGORY_GRID');
  need_reviews BOOLEAN := NOT EXISTS (SELECT 1 FROM "ContentBlock" WHERE page = 'home' AND data->>'type' = 'REVIEWS');
  slots INT;
BEGIN
  slots := need_categories::int + need_reviews::int;
  IF slots = 0 THEN RETURN; END IF;

  -- "En Çok Satanlar": önce anahtarıyla (kaynağı "Kendi kartlarım"a çevrilmiş olabilir), sonra kaynağıyla,
  -- o da yoksa ana sayfadaki son ürün listesi
  SELECT "order" INTO anchor FROM "ContentBlock"
  WHERE page = 'home' AND data->>'type' = 'PRODUCT_LIST'
  ORDER BY (key = 'en-cok-satanlar') DESC, (data->>'source' = 'bestsellers') DESC, "order" DESC
  LIMIT 1;

  IF anchor IS NULL THEN
    SELECT COALESCE(MAX("order"), -1) INTO anchor FROM "ContentBlock" WHERE page = 'home';
  ELSE
    -- Altındaki bölümleri yer açmak için kaydır
    UPDATE "ContentBlock" SET "order" = "order" + slots WHERE page = 'home' AND "order" > anchor;
  END IF;

  IF need_categories THEN
    anchor := anchor + 1;
    INSERT INTO "ContentBlock" (id, page, key, data, "order", "isActive", "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, 'home', 'kategoriler',
            '{"type":"CATEGORY_GRID","eyebrow":"Keşfetmeye Devam Edin","title":"Kategoriler","buttonLabel":"İncele"}'::jsonb,
            anchor, true, now(), now())
    ON CONFLICT DO NOTHING;
  END IF;

  IF need_reviews THEN
    anchor := anchor + 1;
    INSERT INTO "ContentBlock" (id, page, key, data, "order", "isActive", "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, 'home', 'musteri-yorumlari',
            '{"type":"REVIEWS","title":"Müşterilerimizin Kalbinden","cards":[]}'::jsonb,
            anchor, true, now(), now())
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
