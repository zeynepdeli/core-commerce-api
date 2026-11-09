import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PrismaService } from '../prisma/prisma.service.js';

const DAY = 24 * 60 * 60 * 1000;

/**
 * Süresi dolmuş güvenlik kayıtlarını temizler. Bu tablolar her giriş ve
 * yenilemede büyür; temizlenmezse sorgular yavaşlar (performans) ve gereksiz
 * kişisel veri (IP, e-posta) tutulmuş olur (KVKK: veri minimizasyonu).
 * İşlem idempotent: birden fazla API sunucusunda aynı anda çalışması zararsız.
 * AuditLog'a dokunulmaz (güvenlik denetimi için saklanır).
 */
@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Her gece 03:30 (sunucu saati)
  @Cron('30 3 * * *', { name: 'security-cleanup' })
  async run() {
    const now = Date.now();
    try {
      const [attempts, refresh, resets, verifies, carts] = await this.prisma.$transaction([
        this.prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(now - 90 * DAY) } } }),
        // Süresi dolmuş veya 30 günden eski iptal edilmiş oturumlar
        // (yeniden kullanım tespiti için iptal kayıtları bir süre tutulur)
        this.prisma.refreshToken.deleteMany({
          where: { OR: [{ expiresAt: { lt: new Date(now - DAY) } }, { revokedAt: { lt: new Date(now - 30 * DAY) } }] },
        }),
        this.prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date(now - 7 * DAY) } } }),
        this.prisma.emailVerificationToken.deleteMany({ where: { expiresAt: { lt: new Date(now - 7 * DAY) } } }),
        // Süresi dolmuş misafir sepetleri (üye sepetinde expiresAt boştur)
        this.prisma.cart.deleteMany({ where: { userId: null, expiresAt: { lt: new Date(now) } } }),
      ]);
      this.logger.log(
        `Temizlik: ${attempts.count} giriş denemesi, ${refresh.count} oturum, ${resets.count + verifies.count} e-posta bağlantısı, ${carts.count} misafir sepeti silindi.`,
      );
    } catch (error) {
      this.logger.error(`Temizlik başarısız: ${(error as Error).message}`);
    }
  }
}
