/**
 * İlk süper yöneticiyi oluşturur (admin hesapları kayıt formundan açılamaz).
 *
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_NAME="..." pnpm --filter api create-admin
 *
 * Kullanıcı varsa rolü SUPER_ADMIN yapılır ve şifresi güncellenir.
 * Şifre komut geçmişinde kalmasın diye .env'e yazıp sonra silmeniz önerilir.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';

import { PrismaClient } from '../src/generated/prisma/client.js';

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME?.trim() || 'Yönetici';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL zorunludur.');
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('ADMIN_EMAIL geçerli bir e-posta olmalı.');
// Yönetici şifresi müşteriden daha güçlü olmalı
if (!password || password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
  throw new Error('ADMIN_PASSWORD en az 12 karakter olmalı; büyük harf, küçük harf ve rakam içermeli.');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

try {
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: Number(process.env.ARGON2_MEMORY_COST ?? 19456),
    timeCost: Number(process.env.ARGON2_TIME_COST ?? 2),
    parallelism: Number(process.env.ARGON2_PARALLELISM ?? 1),
  });
  const now = new Date();
  const user = await prisma.user.upsert({
    where: { email },
    update: { role: 'SUPER_ADMIN', passwordHash, passwordChangedAt: now, isActive: true, deletedAt: null, lockedUntil: null, failedLoginCount: 0 },
    create: { email, name, role: 'SUPER_ADMIN', passwordHash, emailVerifiedAt: now },
  });
  await prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } });
  console.log(`Süper yönetici hazır: ${email}`);
} finally {
  await prisma.$disconnect();
}
