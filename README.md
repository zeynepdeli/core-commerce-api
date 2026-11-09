# Core Commerce

Yeniden kullanılabilir **e-ticaret çekirdeği**. API ve admin paneli hazırdır;
**mağaza frontend'i her müşteri için ayrı yazılır**. İlk müşteri: enfesGurme.

> Durum: temel altyapı + kimlik doğrulama + katalog (varyant, KDV) + medya + admin paneli. Sıradaki adımlar:
> sepet/sipariş/kargo/kupon/misafir siparişi/sözleşme onayları → iyzico + sipariş e-postaları + iade →
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
