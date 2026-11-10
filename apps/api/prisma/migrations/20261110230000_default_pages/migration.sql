-- Sık kullanılan bilgi sayfaları TASLAK olarak hazır gelir (mağazada görünmez);
-- yönetici içeriği doldurup "Yayında"yı açar. Aynı adreste sayfa varsa dokunulmaz.
INSERT INTO "Page" ("id", "slug", "title", "body", "isPublished", "showInFooter", "order", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'hakkimizda', 'Hakkımızda',
   E'## Biz kimiz?\n\nMağazanızın hikâyesini buraya yazın: nasıl başladınız, ürünlerinizi nereden ve nasıl seçiyorsunuz, sizi farklı kılan ne?\n\n## Neden biz?\n\n- Birinci özelliğiniz\n- İkinci özelliğiniz\n- Üçüncü özelliğiniz',
   false, true, 0, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'iletisim', 'İletişim',
   E'Sorularınız için bize ulaşabilirsiniz.\n\n**E-posta:** ornek@magaza.com\n**Telefon:** 0 (5xx) xxx xx xx\n**Adres:** Mağaza adresiniz\n\nÇalışma saatlerimiz: Hafta içi 09:00–18:00',
   false, true, 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'teslimat-ve-kargo', 'Teslimat ve Kargo',
   E'## Kargo süresi\n\nSiparişleriniz ödemenin ardından en geç X iş günü içinde kargoya verilir.\n\n## Kargo ücreti\n\nX ₺ ve üzeri siparişlerde kargo ücretsizdir.\n\n## Kargo takibi\n\nSiparişiniz kargoya verildiğinde takip numarası e-posta ile gönderilir.',
   false, true, 2, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'iade-ve-degisim', 'İade ve Değişim',
   E'## Cayma hakkı\n\nÜrünü teslim aldığınız tarihten itibaren 14 gün içinde gerekçe göstermeden iade edebilirsiniz.\n\n## İade edilemeyen ürünler\n\nÇabuk bozulabilen gıdalar ve ambalajı açılmış hijyen ürünleri iade edilemez.\n\n## Nasıl iade ederim?\n\nHesabım → Siparişlerim bölümünden iade talebi oluşturun; onaylandıktan sonra ürünü gönderin.',
   false, true, 3, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
