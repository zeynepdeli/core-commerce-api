import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7'de veritabanı adresi schema.prisma'da değil burada tanımlanır.
// `prisma migrate` gibi CLI komutları bu dosyayı okur; uygulama çalışırken
// PrismaService ayrıca bir adapter (PrismaPg) ile bağlanır.
//
// process.env kullanıyoruz (env() değil): `prisma generate` veritabanına
// bağlanmaz, DATABASE_URL olmadan da (CI, Docker derlemesi) çalışabilmeli.
// Migration komutları adres yoksa zaten anlaşılır bir hata verir.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
