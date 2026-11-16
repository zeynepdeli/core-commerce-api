-- Eski enfesGurme ana sayfasındaki "Antep'in Bereketi" bölümü (solda başlık + açıklama, sağda numaralı
-- simge kartları). Ana sayfada yayında bir avantajlar bölümü yoksa "Müşterilerimizin Kalbinden"in hemen üstüne
-- (o yoksa Kategoriler'in altına, o da yoksa en sona) eklenir. Tekrar çalışması güvenlidir.
-- Başlık ve açıklama eski sitenin varsayılanı; kart metinleri örnektir, admin'den değiştirilir.
DO $$
DECLARE
  pos INT;
BEGIN
  IF EXISTS (SELECT 1 FROM "ContentBlock" WHERE page = 'home' AND data->>'type' = 'FEATURES' AND "isActive") THEN
    RETURN;
  END IF;

  SELECT "order" INTO pos FROM "ContentBlock"
  WHERE page = 'home' AND data->>'type' = 'REVIEWS'
  ORDER BY "order" LIMIT 1;

  IF pos IS NULL THEN
    SELECT "order" + 1 INTO pos FROM "ContentBlock"
    WHERE page = 'home' AND data->>'type' = 'CATEGORY_GRID'
    ORDER BY "order" DESC LIMIT 1;
  END IF;

  IF pos IS NULL THEN
    SELECT COALESCE(MAX("order"), -1) + 1 INTO pos FROM "ContentBlock" WHERE page = 'home';
  END IF;

  -- Yer aç
  UPDATE "ContentBlock" SET "order" = "order" + 1 WHERE page = 'home' AND "order" >= pos;

  INSERT INTO "ContentBlock" (id, page, key, data, "order", "isActive", "createdAt", "updatedAt")
  VALUES (gen_random_uuid()::text, 'home', 'antepin-bereketi',
          jsonb_build_object(
            'type', 'FEATURES',
            'title', 'ANTEP''İN BEREKETİ',
            'description', 'Gaziantep''in binlerce yıllık köklü mutfak mirasını, geleneksel yöntemlerle ve el emeğiyle modern sofralara taşıyoruz.',
            'items', jsonb_build_array(
              jsonb_build_object('icon', 'leaf', 'title', 'Doğal ve Katkısız'),
              jsonb_build_object('icon', 'award', 'title', 'Geleneksel Tarifler'),
              jsonb_build_object('icon', 'shield', 'title', 'Güvenli Alışveriş'),
              jsonb_build_object('icon', 'package', 'title', 'Özenli Paketleme')
            )
          ),
          pos, true, now(), now())
  ON CONFLICT DO NOTHING;
END $$;
