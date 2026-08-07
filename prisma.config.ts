import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Prisma 7'de veritabanı bağlantı adresi artık schema.prisma'da DEĞİL,
// burada tanımlanıyor. `prisma migrate`, `prisma studio` gibi CLI
// komutları bu dosyayı okuyor. Uygulama çalışırken (runtime) ise
// PrismaClient'a ayrıca bir "adapter" vereceğiz (bir sonraki adımda,
// PrismaService yazarken göreceğiz) — ikisi ayrı ayrı DATABASE_URL
// okusa da kaynak aynı .env dosyası.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
