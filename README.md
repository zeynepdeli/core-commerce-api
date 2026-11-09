# Core Commerce

Yeniden kullanılabilir **e-ticaret çekirdeği**. API ve admin paneli hazırdır;
**mağaza frontend'i her müşteri için ayrı yazılır**. İlk müşteri: enfesGurme.

> Durum: temel altyapı + kimlik doğrulama. Sıradaki adımlar: katalog → admin paneli →
> sepet/sipariş → iyzico ödeme → yorum/beğeni → tema/içerik/SSS.

| Klasör | İçerik |
|---|---|
| `apps/api` | NestJS 12 · Prisma 7 · PostgreSQL |
| `apps/admin` | (yakında) Next.js yönetim paneli |
| `infrastructure/` | Yerel geliştirme veritabanı (Docker Compose) |

## Yerel geliştirme

Gereken: Node 24 (`.nvmrc`), pnpm 10 (`corepack enable`), Docker.

```bash
pnpm install
docker compose -f infrastructure/compose.yaml up -d      # PostgreSQL (localhost:5434)

cp apps/api/.env.example apps/api/.env                  # JWT_ACCESS_SECRET'ı doldurun: openssl rand -base64 64
pnpm --filter api db:migrate                            # tabloları oluştur
ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm --filter api create-admin   # ilk süper yönetici
pnpm dev:api                                            # http://localhost:4000/health
```

Şemayı değiştirince: `pnpm --filter api db:migrate:dev --name <degisiklik-adi>`.

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
- **Sırlar:** `.env*` dosyaları commit edilmez.

## Kontroller

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

GitHub Actions her PR'da bunları ve migration'ların boş veritabanına uygulanmasını çalıştırır.
