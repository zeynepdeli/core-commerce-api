# Core Commerce

Yeniden kullanılabilir **e-ticaret çekirdeği**. API ve admin paneli hazırdır;
**mağaza frontend'i her müşteri için ayrı yazılır**. İlk müşteri: enfesGurme.

> Durum: temel altyapı. Sıradaki adımlar: kimlik doğrulama → katalog → admin paneli →
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
pnpm dev:api                                            # http://localhost:4000/health
```

Şemayı değiştirince: `pnpm --filter api db:migrate:dev --name <degisiklik-adi>`.

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
- **Sırlar:** `.env*` dosyaları commit edilmez.

## Kontroller

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

GitHub Actions her PR'da bunları ve migration'ların boş veritabanına uygulanmasını çalıştırır.
