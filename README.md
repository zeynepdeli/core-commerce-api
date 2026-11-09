# Core Commerce

Yeniden kullanılabilir **e-ticaret çekirdeği**. API ve admin paneli hazırdır;
**mağaza frontend'i her müşteri için ayrı yazılır**. İlk müşteri: enfesGurme.

> Durum: temel altyapı + kimlik doğrulama + katalog (varyant, KDV) + medya + admin paneli + sepet/kupon/kargo/adres + sipariş.
> Sıradaki adımlar: iyzico + sipariş e-postaları + iade →
> admin 2FA → satış raporları → pazarlama (stok bildirimi, sepet hatırlatma, Google Merchant) →
> yorum/beğeni → tema/içerik/SSS.

| Klasör | İçerik |
|---|---|
| `apps/api` | NestJS 12 · Prisma 7 · PostgreSQL |
| `apps/admin` | Next.js 16 yönetim paneli (port 3001) |
| `infrastructure/` | Yerel geliştirme veritabanı (Docker Compose) |

## Yerel geliştirme

Gereken: Node 24 (`.nvmrc`), pnpm 10 (`corepack enable`), Docker.

```bash
pnpm install
docker compose -f infrastructure/compose.yaml up -d      # PostgreSQL (localhost:5434)

cp apps/api/.env.example apps/api/.env                  # JWT_ACCESS_SECRET'ı doldurun: openssl rand -base64 64
cp apps/admin/.env.example apps/admin/.env.local        # WEB_API_SECRET, API'dekiyle AYNI olmalı
pnpm --filter api db:migrate                            # tabloları oluştur
ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm --filter api create-admin   # ilk süper yönetici
pnpm dev                                                # API :4000 + admin :3001 birlikte
```

Şemayı değiştirince: `pnpm --filter api db:migrate:dev --name <degisiklik-adi>`.

## Admin paneli

http://localhost:3001 — yalnızca `ADMIN` / `SUPER_ADMIN` rolündeki hesaplar girebilir
(müşteri hesabıyla giriş denenirse açılan oturum hemen kapatılır).

- **Dashboard:** Mağaza (Ürün / Kategori Yönetimi, Medya) ve Kullanıcılar kutucukları; stoğu azalan ürün sayısı.
- **Ürün Yönetimi:** arama (ad, açıklama, SKU), kategori ve durum filtresi, sayfalama. Ürün formu başlıklı
  panellerden oluşur (Temel Bilgiler, Fiyat ve Stok, Görseller, Detay Sekmeleri, Yayın, SEO), altta tek
  kaydet butonu. Tek seçenekli üründe sade fiyat/stok alanları; "Seçenekli Ürün Yap" ile seçenek tablosu.
- **Kategori Yönetimi**, **Medya Kütüphanesi**, **Kullanıcı Yönetimi** (askıya alma, kilit açma, rol —
  rolü yalnızca süper yönetici değiştirir), **Hesabım** (şifre değiştirme).
- Marka: `apps/admin/src/brand/brand.ts` (ad, logo) ve `theme.css` (renkler).

Güvenlik: token'lar yalnızca admin sunucusunda, `httpOnly` + `SameSite=Strict` çerezde; tarayıcı kodu
görmez. Erişim token'ı dolunca `proxy.ts` oturumu sessizce yeniler. Her sayfada rol API'den doğrulanır.
Yöneticinin şifre sıfırlama bağlantısı admin paneline (`ADMIN_URL`) gider; token adresin `#` kısmındadır
ve okunur okunmaz adresten silinir. Panel arama motorlarına kapalıdır (`noindex`).

## Kimlik doğrulama API'si

Mağaza ve admin, API'yi **kendi sunucusundan** çağırır ve token'ları kendi alan adında
`httpOnly` çerezde saklar (tarayıcı JavaScript'i token'ı göremez). Sunucu, gerçek ziyaretçi
IP'sini `X-Client-IP` + `X-Web-Secret` (= `WEB_API_SECRET`) başlıklarıyla iletir.

| Uç | Açıklama |
|---|---|
| `POST /auth/register` | `{email, password, name}` → 202, e-posta kayıtlı olsa da AYNI yanıt |
| `POST /auth/login` | `{email, password}` → `{accessToken, accessTokenExpiresIn, refreshToken, refreshTokenExpiresAt, user}` |
| `POST /auth/google` | `{idToken}` (Google Identity Services) → giriş/kayıt |
| `POST /auth/refresh` | `{refreshToken}` → yeni çift (eski token iptal) |
| `POST /auth/logout` | `{refreshToken}` → bu cihazın oturumu kapanır |
| `POST /auth/verify-email` | `{token}` |
| `POST /auth/resend-verification` | `{email}` |
| `POST /auth/forgot-password` | `{email}` → 202, her durumda aynı yanıt |
| `POST /auth/reset-password` | `{token, password}` → tüm oturumlar kapanır |
| `GET/PATCH /account/me` | Profil (Bearer) |
| `POST /account/change-password` | `{currentPassword, newPassword}` → tüm oturumlar kapanır, yeni çift döner |
| `POST /account/logout-all` | Tüm cihazlardan çıkış |
| `DELETE /account` | Hesap kapatma (KVKK) `{password}` |
| `GET /admin/users` | Kullanıcı listesi `?q=&role=&status=active\|inactive\|locked\|deleted&page=` (ADMIN) |
| `PATCH /admin/users/:id/active` · `POST /admin/users/:id/unlock` | Askıya alma, kilit açma (ADMIN) |
| `PATCH /admin/users/:id/role` | Rol değiştirme (yalnızca SUPER_ADMIN) |

E-postadaki bağlantılar `STOREFRONT_URL/eposta-dogrula#token=…` ve `STOREFRONT_URL/sifre-sifirla#token=…`
biçimindedir: token adresin `#` kısmındadır, sunucu loglarına ve Referer başlığına düşmez.
Mağaza sayfası token'ı `location.hash`'ten okuyup API'ye göndermelidir.

## Katalog ve medya API'si

| Uç | Kimler | Açıklama |
|---|---|---|
| `GET /shop/categories` · `/shop/categories/:slug` | Herkes | Yayındaki kategoriler (ürün sayısıyla) |
| `GET /shop/products?category=&q=&sort=new\|price-asc\|price-desc\|name&featured=true&page=&limit=` | Herkes | Sayfalı liste (limit ≤ 48) |
| `GET /shop/products/:slug` | Herkes | Ürün detayı: görseller, sekmeler, SEO |
| `/admin/shop/categories` (GET, POST, `PATCH reorder`, `PATCH/DELETE :id`) | ADMIN | Kategori yönetimi |
| `/admin/shop/products` (GET `?q=&category=&status=active\|inactive\|low-stock&page=`, POST, `GET/PATCH/DELETE :id`) | ADMIN | Ürün yönetimi |
| `/admin/media` (GET `?page=`, `POST upload`, `PATCH/DELETE :id`) | ADMIN | Medya kütüphanesi |
| `GET /media/:dosya` | Herkes | Yerel görseller (1 yıl önbellek) |

- **Varyantlar:** satılan şey varyanttır (ör. 250 g / 500 g / 1 kg); fiyat, eski fiyat, stok ve SKU
  varyanttadır. Her ürünün en az bir varyantı olur. Ürünün `price` alanı satıştaki en ucuz varyantın
  fiyatıdır ("…'den başlayan"), otomatik hesaplanır. Güncellemede `id`'li varyant güncellenir, `id`'siz
  olan eklenir, listede olmayan soft delete edilir (geçmiş siparişler bozulmaz).
- **KDV:** ürün başına `vatRate` (0, 1, 10, 20). Fiyatlar KDV dahildir.
- Fiyatlar `"249.90"` biçiminde metin döner (kuruş hatası olmasın). Kesin stok adedi ziyaretçiye
  verilmez, yalnızca `inStock`. Para birimi mağaza genelinde tektir (`TRY`), dışarıdan değiştirilemez.
- Silme **soft delete**'tir: geçmiş siparişler ürüne bağlı kalır, ürün mağazadan ve sepetlerden kalkar,
  adres (slug) ve stok kodu yeni ürün için serbest kalır. İçinde ürün olan kategori silinemez.
- Ürün detay sekmeleri (`tabs`) serbesttir; enfesGurme'deki Hikaye / Özellikler / Nasıl Servis Edilir?
  alanları migration ile otomatik sekmeye çevrildi.
- Yüklenen görseller yeniden kodlanır (gizli içerik ve EXIF/GPS silinir), en uzun kenar 2560 px'e
  küçültülür. Kullanımdaki görsel silinemez.

## Sepet, kupon, kargo, adres API'si

| Uç | Açıklama |
|---|---|
| `GET /cart` | Sepet: güncel fiyat/stokla satırlar, ara toplam, indirim, kargo, KDV, toplam, `canCheckout` |
| `PUT /cart/items` `{variantId, quantity}` | Adet ayarla (0 = kaldır); stoktan fazlası eklenemez |
| `DELETE /cart/items/:variantId` | Satırı kaldır |
| `POST /cart/coupon` `{code}` · `DELETE /cart/coupon` | Kupon uygula / kaldır (IP başına 10/dk) |
| `POST /cart/merge` `{cartToken}` | Girişten sonra misafir sepetini üye sepetine aktar |
| `GET /shop/settings` | Kargo ücreti, ücretsiz kargo eşiği, en düşük sipariş tutarı |
| `GET/POST/PUT/DELETE /account/addresses` | Müşterinin adres defteri (en fazla 20) |
| `GET/PUT /admin/store-settings` · `/admin/coupons` | Kargo ayarları ve kupon yönetimi (ADMIN) |

- **Misafir sepeti:** Üye için `Authorization: Bearer …`, misafir için `X-Cart-Token` başlığı kullanılır.
  Misafir sepeti ilk ürün eklendiğinde oluşur ve token yanıtta **bir kez** (`cartToken`) döner; mağaza sunucusu bunu
  httpOnly çerezde saklar. Veritabanında yalnızca SHA-256 özeti tutulur; misafir sepeti 30 gün sonra silinir.
- **Tutar hesabı:** Tutarlar yalnızca sunucuda ve kuruş cinsinden tam sayıyla hesaplanır; istemciden fiyat kabul edilmez.
  Sepet ekranı ve sipariş aynı hesap fonksiyonunu (`commerce/pricing.ts`) kullanır. Satışta olmayan, tükenen veya
  stoktan fazla adetli satır tutara katılmaz ve `canCheckout` false olur.
- **Kupon:** Kod büyük harfe çevrilir (Türkçe i/ı farkı yok). Var olmayan ve pasif kupon için aynı mesaj döner
  (kod tahmini zorlaşır). Yüzde kuponda üst sınır; ücretsiz kargo eşiği indirim sonrası tutara bakar.
- **KDV:** İndirim satırlara tutarlarıyla orantılı dağıtılır; her satırın KDV'si kendi oranıyla, kargonunki %20 ile hesaplanır.

## Sipariş API'si

| Uç | Açıklama |
|---|---|
| `POST /checkout/preview` | Güncel tutar + doldurulmuş Ön Bilgilendirme Formu / Mesafeli Satış Sözleşmesi / KVKK metni |
| `POST /checkout` | Siparişi oluşturur (üye veya misafir). Gövde: `idempotencyKey`, `email` (misafir), `shippingAddressId` veya `shippingAddress`, `billing`, `acceptPreInformation: true`, `acceptDistanceSales: true`, `marketingEmail?`, `marketingSms?`, `note?` |
| `GET /account/orders` · `GET /account/orders/:no` · `POST /account/orders/:no/cancel` | Üyenin siparişleri; ödenmemiş sipariş iptali |
| `POST /orders/lookup` `{orderNumber, accessToken}` | Misafir sipariş takibi (anahtar siparişte bir kez döner) |
| `GET /shop/legal/:type` | KVKK aydınlatma metni vb. (satıcı bilgileri doldurulmuş) |
| `/admin/orders` (liste, detay, `PATCH :id/status`) · `/admin/legal` | Sipariş ve yasal metin yönetimi (ADMIN) |

- **Tek işlem (transaction):** Fiyat ve stok yeniden okunur, stok **koşullu** düşülür (son ürünü aynı anda iki kişi alamaz),
  tutar sunucuda hesaplanır, kupon kullanımı koşullu ayrılır, sipariş + adres/fatura kopyası + onaylanan sözleşmelerin
  doldurulmuş hali (SHA-256 özetiyle, IP ve tarayıcı bilgisiyle) + ticari ileti izinleri (İYS) kaydedilir.
- **Çift sipariş yok:** Aynı `idempotencyKey` tekrar gelirse aynı sipariş döner. Aynı sepetten yeni sipariş verilirse
  önceki ödenmemiş sipariş iptal edilip stok serbest bırakılır.
- **Ödeme süresi:** Ödenmeyen sipariş (varsayılan 30 dk) dolunca otomatik iptal edilir, stok ve kupon hakkı geri döner.
- **Durumlar:** Ödeme bekleniyor → Ödeme alındı → Hazırlanıyor → Kargoda (firma + takip no zorunlu) → Teslim edildi;
  iptal ve iade. Geçersiz geçiş reddedilir; her değişiklik zaman çizelgesine ve AuditLog'a yazılır.
- **Fatura:** Bireysel (isteğe bağlı TCKN, algoritmayla doğrulanır) veya kurumsal (unvan, vergi dairesi, VKN doğrulanır).
  TCKN/VKN müşteriye maskeli, admin'e tam gösterilir.

## Ödeme (iyzico)

| Uç | Açıklama |
|---|---|
| `POST /payments/iyzico/init` `{orderNumber, accessToken?}` | iyzico ödeme sayfası adresini döner (üye: oturum; misafir: sipariş erişim anahtarı). Mağaza müşteriyi bu adrese yönlendirir. |
| `POST /payments/iyzico/callback` | iyzico'nun döndüğü adres. Sonucu işler, müşteriyi `STOREFRONT_URL/siparis/sonuc?siparis=…&durum=basarili\|basarisiz[&neden=…]` adresine yönlendirir. |

- **Kart bilgisi bize hiç gelmez:** iyzico'nun barındırdığı ödeme formu kullanılır (PCI-DSS kapsamı dışı). Yalnızca ödeme no,
  taksit, kart markası ve son 4 hane saklanır.
- **Tarayıcıya güvenilmez:** Geri dönüşte gelen token ile sonuç iyzico'dan **sunucu-sunucu** sorgulanır; yanıt imzası (HMAC-SHA256),
  sepet no = sipariş, oturum no, tutar ve para birimi doğrulanır. Tutar tutmazsa veya imza bozuksa sipariş ödenmiş sayılmaz.
- **Tek sefer:** Aynı sonuç iki kez gelirse (yenileme, çift tık) ikinci kez işlenmez.
- **Süre:** Ödeme sayfası açılınca sipariş en az 30 dk daha bekletilir (en fazla sipariş anından itibaren 2 saat — stok kilitleme
  saldırısına karşı). Süre dolup iptal edilen siparişe sonradan ödeme gelirse stok varsa sipariş canlanır; yoksa yöneticiye
  **"İADE GEREKLİ"** e-postası gider ve AuditLog'a yazılır.
- **E-postalar:** Ödeme alındı (müşteri + yönetici), kargoya verildi (firma + takip no), iptal (yalnızca ödenmiş siparişte).

## İade (cayma hakkı)

| Uç | Açıklama |
|---|---|
| `POST /account/orders/:no/returns` · `POST /account/orders/:no/returns/:id/cancel` | Üye iade talebi / vazgeçme. Gövde: `items: [{orderItemId, quantity}]`, `reason` (`DAMAGED`, `WRONG_ITEM`, `NOT_AS_DESCRIBED`, `CHANGED_MIND`, `OTHER`), `note?` |
| `POST /orders/returns` · `POST /orders/returns/:id/cancel` | Misafir: aynısı + `orderNumber`, `accessToken` |
| `/admin/returns` (liste, detay, `PATCH :id/decision`, `POST :id/receive`, `POST :id/refund`) | Yönetim (ADMIN) |
| `POST /admin/orders/:id/refund` | İptal edilmiş, kartla ödenmiş siparişin iadesini yeniden dener |

- **Süre:** Teslimden itibaren `returnWindowDays` gün (mağaza ayarı; yasal alt sınır 14). Kargodaki siparişte süre henüz başlamamıştır.
  Süre sözleşmelere `{{CAYMA_SURESI}}` ile otomatik yazılır.
- **İade edilemeyen ürünler:** Üründe "İade edilebilir" kapatılırsa (çabuk bozulan gıda vb., yönetmelik md. 15) sözleşmede belirtilir ve talep edilemez.
  Sipariş anındaki değer saklanır.
- **Tutar sunucuda hesaplanır:** Kupon indirimi satırlara dağıtılmış, ödenen tutar üzerinden (iyzico'daki kalem tutarıyla birebir).
  Siparişin tamamı iade edilirse ilk kargo ücreti de iade edilir (md. 13). Eş zamanlı talepler adetleri aşamaz (satır kilidi).
- **Akış:** Talep → Onay (müşteriye not, iade adresi e-postada) veya Ret (gerekçe zorunlu) → Ürün geldi (isteğe bağlı stoğa ekle)
  → Ücret iadesi. Her adımda müşteriye e-posta.
- **iyzico iadesi:** Kalem bazında; çift tıklamada iki kez iade yapılmaz (kilit), yarıda kalırsa yalnızca kalan kalemler denenir.
  Kartla ödenmemiş (havale) siparişte "Elle iade edildi" işaretlenir. Tamamı iade edilen sipariş "İade edildi" olur.
- **Kargodan önce iptal:** Admin ödenmiş siparişi iptal ederse ücret otomatik iade edilir (önce iyzico iptali, olmazsa kalem kalem iade).
  Başarısız olursa yöneticiye e-posta + sipariş sayfasında "İadeyi iyzico ile yap" düğmesi.

## Yorumlar ve favoriler

| Uç | Açıklama |
|---|---|
| `GET /shop/products/:slug/reviews?sort=new\|rating-high\|rating-low&rating=1-5&page` | Yayındaki yorumlar + özet (ortalama, sayı, 1–5 dağılımı) |
| `GET /account/reviews` · `GET /account/reviews/eligible` · `POST /account/reviews` · `PATCH/DELETE /account/reviews/:id` | Üyenin yorumları, "değerlendirin" listesi |
| `GET /account/favorites` · `GET /account/favorites/ids` · `PUT/DELETE /account/favorites/:productId` | Favoriler |
| `/admin/reviews` (liste, `PATCH :id` onay/ret, `PUT :id/reply`, `DELETE :id`, `GET favorites`) | Yönetim |

- **Yalnızca satın alanlar:** Ürünü içeren siparişi kargolanmış/teslim edilmiş üye yorum yapabilir ("Doğrulanmış alıcı"). Ürün başına bir yorum.
- **Onay:** Varsayılan olarak onaydan sonra yayınlanır (ayar: `reviewAutoApprove`); düzenlenen yorum yeniden onaya düşer. Ret gerekçesi yazara e-postayla gider.
- **Kişisel veri:** Mağazada ad maskelenir ("Ayşe Y."), e-posta/kimlik dönmez. Hesap kapatılınca yorumlar ve favoriler silinir, puanlar yeniden hesaplanır.
- **Puan özeti** ürün tablosunda tutulur (`ratingAvg`, `ratingCount`; liste ve `sort=rating` için hızlı). Yorum metni düz metindir.

## Pazarlama

| Uç | Açıklama |
|---|---|
| `POST /shop/stock-alerts` `{variantId, email?}` | "Gelince haber ver" (üyede hesap e-postası). Yanıt her durumda aynı |
| `GET/PUT /account/consents` `{email?, sms?}` | Üyenin ticari ileti izinleri (İYS) |
| `POST /marketing/unsubscribe` `{token}` | E-postadaki tek tıkla izinden çıkma (mağaza `/ileti-izni#t=…` sayfası POST eder) |
| `GET /feeds/google.xml` | Google Merchant Center ürün akışı (ayardan açılır) |
| `/admin/marketing` (özet, `POST run`, `POST feed/refresh`) | Yönetim |

- **Stok bildirimi:** Stoğa giren varyantın bekleyen talepleri 10 dakikada bir e-postalanır, talep kapanır (tek seferlik, müşterinin isteği → izin gerekmez).
  Bir e-posta en fazla 10 bekleyen talep (başkası adına toplu kayıt engeli); 180 günden eski talepler silinir.
- **Sepet hatırlatma (ticari ileti):** Yalnızca üyeler, e-postası doğrulanmış ve **en son İYS kaydı "izin verdi"** olanlar. Sepet ayarlanan süre hareketsiz kalınca,
  en fazla 7 günlük sepete, kişi başı haftada bir, sepet değişmedikçe tek kez. Arada sipariş verdiyse gönderilmez. Her e-postada imzalı (değiştirilemez)
  tek tıkla ret bağlantısı ve satıcı bilgisi. İzin değişiklikleri silinmez, yeni satır olarak tutulur; gönderilen her ileti `MarketingMessage`'a yazılır.
- **Google akışı:** RSS 2.0 + `g:` alanları; yalnızca yayındaki, görselli ürünler; varyant başına bir kalem (`item_group_id`), indirimde `price`/`sale_price`,
  stokta var/yok (adet paylaşılmaz). XML kaçışlı; 10 dk önbellek + ETag. Ürün bağlantısı `STOREFRONT_URL` + `STOREFRONT_PRODUCT_PATH`.

## Satış raporları

| Uç | Açıklama |
|---|---|
| `GET /admin/reports/sales?from=YYYY-AA-GG&to=YYYY-AA-GG&groupBy=day\|week\|month` | Özet + önceki dönemle karşılaştırma, zaman serisi, en çok satanlar, kategoriler, kuponlar, yeni/tekrar müşteri, ödeme dönüşümü |
| `GET /admin/reports/sales.csv?from&to` | Muhasebe için ödenmiş siparişler (Türkçe Excel: UTF-8 BOM, `;` ayraç, `,` ondalık) |

- **Satış** = ödemesi alınmış sipariş, **ödeme tarihine** göre. **İadeler** yapıldıkları tarihte düşülür (iade talepleri + ödendikten sonra iptal edilenler); net = brüt − iade.
- Gün sınırları `STORE_TIMEZONE` (varsayılan Europe/Istanbul) saat dilimine göre; dönüşümü PostgreSQL yapar (yaz saati dahil).
- Aralık en fazla 1 yıl; boş günler 0 ile döner. Tüm sorgular parametreli; tarih alanları sıkı biçim denetiminden geçer.
- CSV: formül enjeksiyonuna karşı `= + - @` ile başlayan hücreler etkisizleştirilir; en fazla 20.000 satır.
- Admin: **Raporlar** sayfası (hazır aralıklar, özel tarih, gruplama, grafik + tablo görünümü, CSV indir).

## İki adımlı doğrulama (yöneticiler)

| Uç | Açıklama |
|---|---|
| `POST /auth/login` | 2FA açıksa token yerine `{ twoFactorRequired: true, challengeToken, expiresIn }` döner |
| `POST /auth/2fa` `{challengeToken, code}` | 6 haneli kod veya `ABCDE-FGHJK` yedek kod → oturum |
| `GET /account/2fa` · `POST /account/2fa/setup` `{password}` · `/enable` `{code}` · `/disable` `{password, code}` · `/recovery-codes` `{code}` | Kurulum ve yönetim (yalnızca yöneticiler) |
| `POST /admin/users/:id/two-factor/reset` | SUPER_ADMIN: telefonunu ve yedek kodlarını kaybedenin 2FA'sını sıfırlar |

- **TOTP (RFC 6238):** Google/Microsoft Authenticator, 1Password vb. ile uyumlu; harici kütüphane yok, RFC test vektörleriyle test edildi.
- **Gizli anahtar şifreli:** AES-256-GCM (`TWO_FACTOR_ENCRYPTION_KEY`), kullanıcı kimliğine bağlı; veritabanı sızsa bile kullanılamaz.
- **Giriş:** Şifre doğruysa 5 dk geçerli, tek kullanımlık, en fazla 5 denemelik bir giriş anahtarı verilir (admin'de httpOnly çerezde).
  Hatalı kodlar hesap kilitleme sayacına eklenir. Aynı kod ikinci kez kabul edilmez (replay).
- **Yedek kodlar:** 10 adet, tek kullanımlık, yalnızca SHA-256 özeti saklanır; kullanılınca e-posta bildirimi.
- **Açılınca** diğer tüm oturumlar kapanır (o andan önce verilmiş erişim token'ları milisaniye hassasiyetle reddedilir).
- **Zorunluluk:** `ADMIN_2FA_REQUIRED` (boşsa production'da açık). Kurmamış yönetici yönetim uçlarından 403 `TWO_FACTOR_SETUP_REQUIRED` alır;
  admin paneli kurulum ekranına yönlendirir.
- Kurulum için şifre tekrar sorulur (açık unutulmuş bir oturumla başkası kendi telefonunu bağlayamaz). Açma/kapama/sıfırlama e-postayla bildirilir.

## Güvenlik ilkeleri (OWASP)

- **Yapılandırma (A05):** Ortam değişkenleri açılışta doğrulanır; zayıf/eksik değerle API başlamaz.
  Production'da CORS adresleri HTTPS olmak zorundadır.
- **Girdi (A03):** Tüm istekler DTO beyaz listesiyle doğrulanır; tanımsız alan gelirse istek reddedilir
  (`"role": "ADMIN"` gibi mass assignment denemeleri dahil).
- **Kaynak tüketimi (API4):** Global ve uç bazlı hız sınırı, istek gövdesi boyut sınırı.
  Gerçek ziyaretçi IP'si yalnızca güvenilir proxy ayarı veya imzalı başlıkla kabul edilir.
- **Başlıklar:** Helmet (sıkı CSP, production'da HSTS), `x-powered-by` kapalı,
  kişisel yanıtlarda `Cache-Control: no-store`.
- **Bilgi sızıntısı:** Sağlık ucu (`/health`) sürüm veya veritabanı ayrıntısı vermez.
- **Kimlik (A07):** argon2id (OWASP alt sınırlı), kullanıcı varlığını süreden belli etmeyen sahte
  doğrulama, genel hata mesajları, hesap kilitleme + IP hız sınırı, `LoginAttempt` kaydı.
  Refresh token rastgele ve tek kullanımlıktır (rotation); iptal edilmiş token tekrar gelirse tüm
  oturum zinciri kapanır. Şifre değişince eski erişim token'ları da geçersizdir.
  Kullanıcı her istekte veritabanından okunur: askıya alma/rol değişikliği anında geçerlidir.
- **Erişim (A01):** Rol hiyerarşisi CUSTOMER < ADMIN < SUPER_ADMIN; rol yalnızca SUPER_ADMIN
  tarafından, kendine değil, son süper yönetici düşürülemeyecek şekilde değiştirilir.
- **Google:** ID token imza/süre/audience doğrulaması; doğrulanmamış yerel hesaba bağlanırken o
  hesabın şifresi silinir (hesabı önceden ele geçirme koruması).
- **Kayıt (A09):** Güvenlik olayları `AuditLog`'a yazılır (giriş kilidi, token yeniden kullanımı,
  şifre sıfırlama, rol değişikliği…). Şifre ve token'lar hiçbir yere loglanmaz.
- **Performans/veri minimizasyonu:** Her gece eski giriş denemeleri, süresi dolmuş oturumlar ve
  e-posta bağlantıları silinir. Liste sorguları yalnızca gereken kolonları seçer ve indekslidir
  (5000 ürünle mağaza listesi ~10 ms). Yavaş istemci saldırılarına karşı HTTP zaman aşımları.
- **Sırlar:** `.env*` dosyaları commit edilmez.

## Kontroller

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

GitHub Actions her PR'da bunları ve migration'ların boş veritabanına uygulanmasını çalıştırır.
