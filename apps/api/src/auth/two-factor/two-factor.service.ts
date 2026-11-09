import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'node:crypto';

import { AuditService } from '../../audit/audit.service.js';
import type { Env } from '../../config/env.validation.js';
import type { Role } from '../../generated/prisma/client.js';
import { MailService } from '../../mail/mail.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PasswordService } from '../password.service.js';
import { hashToken, newSecureToken } from '../secure-token.js';
import type { ClientMeta } from '../tokens.service.js';

import { SecretBox } from './secret-box.js';
import { newTotpSecret, otpauthUrl, verifyTotp } from './totp.js';

const CHALLENGE_TTL_MS = 5 * 60_000;
const CHALLENGE_MAX_ATTEMPTS = 5;
const RECOVERY_COUNT = 10;
// Karışabilecek karakterler yok (0/O, 1/I/L)
const RECOVERY_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const INVALID_CODE = 'Doğrulama kodu hatalı veya süresi dolmuş.';

export const TWO_FACTOR_SETUP_REQUIRED = 'TWO_FACTOR_SETUP_REQUIRED';

/** "ABCDE-FGHJK" → "ABCDEFGHJK" (kullanıcı tire/boşlukla yazabilir) */
const normalizeRecovery = (code: string) => code.toUpperCase().replace(/[\s-]/g, '');

/**
 * Yönetici hesapları için iki adımlı doğrulama (TOTP + tek kullanımlık yedek kodlar).
 * Şifre çalınsa bile panele girilemez. Gizli anahtar şifreli saklanır; aynı kod iki kez
 * kullanılamaz; kod denemeleri hesap kilitleme sayacına eklenir.
 */
@Injectable()
export class TwoFactorService {
  private readonly box: SecretBox;
  private readonly required: boolean;
  private readonly issuer: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Env, true>,
  ) {
    const key = config.get('TWO_FACTOR_ENCRYPTION_KEY', { infer: true });
    this.box = new SecretBox(key ? Buffer.from(key, 'base64') : undefined, config.get('JWT_ACCESS_SECRET', { infer: true }));
    const flag = config.get('ADMIN_2FA_REQUIRED', { infer: true });
    this.required = flag ? flag === 'true' : config.get('NODE_ENV', { infer: true }) === 'production';
    this.issuer = new URL(config.get('ADMIN_URL', { infer: true })).hostname || 'Core Commerce';
  }

  /** Bu rol için 2FA zorunlu mu (yöneticiler, ayar açıksa) */
  requiredFor(role: Role) {
    return this.required && role !== 'CUSTOMER';
  }

  async status(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true, twoFactorEnabledAt: true } });
    const remaining = user.twoFactorEnabledAt ? await this.prisma.twoFactorRecoveryCode.count({ where: { userId, usedAt: null } }) : 0;
    return { enabled: !!user.twoFactorEnabledAt, enabledAt: user.twoFactorEnabledAt, required: this.requiredFor(user.role), recoveryCodesRemaining: remaining };
  }

  // ───────────── Kurulum ─────────────

  private async loadAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı.');
    if (user.role === 'CUSTOMER') throw new ForbiddenException('İki adımlı doğrulama yönetici hesapları içindir.');
    return user;
  }

  private async checkPassword(hash: string | null, password: string) {
    if (!hash) throw new BadRequestException('Hesabınızda şifre yok. Önce "Şifremi unuttum" ile şifre belirleyin.');
    if (!(await this.password.verify(hash, password))) throw new UnauthorizedException('Şifre hatalı.');
  }

  /**
   * 1. adım: şifre tekrar sorulur (açık bırakılmış bir oturumla başkası kendi
   * telefonunu bağlayamasın). Anahtar henüz etkin değil; kodla doğrulanınca etkinleşir.
   */
  async startSetup(userId: string, password: string) {
    const user = await this.loadAdmin(userId);
    if (user.twoFactorEnabledAt) throw new ConflictException('İki adımlı doğrulama zaten açık.');
    await this.checkPassword(user.passwordHash, password);
    const secret = newTotpSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorPendingSecret: this.box.seal(secret, userId) } });
    return { secret, otpauthUrl: otpauthUrl(secret, user.email, this.issuer) };
  }

  /** 2. adım: uygulamadaki kod doğrulanır, yedek kodlar bir kez gösterilir, diğer oturumlar kapanır */
  async enable(userId: string, code: string, meta: ClientMeta) {
    const user = await this.loadAdmin(userId);
    if (user.twoFactorEnabledAt) throw new ConflictException('İki adımlı doğrulama zaten açık.');
    const secret = user.twoFactorPendingSecret ? this.box.open(user.twoFactorPendingSecret, userId) : null;
    if (!secret) throw new BadRequestException('Önce kurulumu başlatın.');
    const step = verifyTotp(secret, code);
    if (step === null) throw new BadRequestException('Kod hatalı. Telefonunuzun saatinin doğru olduğundan emin olun.');

    const now = new Date();
    const codes = this.newRecoveryCodes();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { twoFactorSecret: user.twoFactorPendingSecret, twoFactorPendingSecret: null, twoFactorEnabledAt: now, twoFactorLastStep: step, sessionsValidFrom: now },
      }),
      this.prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
      this.prisma.twoFactorRecoveryCode.createMany({ data: codes.map((c) => ({ userId, codeHash: hashToken(normalizeRecovery(c)) })) }),
      // 2FA'sız açılmış tüm oturumlar kapanır
      this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } }),
    ]);
    await this.audit.log({ action: 'auth.2fa_enabled', entity: 'User', entityId: userId, userId, ipAddress: meta.ipAddress });
    this.notify(user.email, 'İki adımlı doğrulama açıldı', 'Hesabınızda iki adımlı doğrulama açıldı. Bu işlemi siz yapmadıysanız hemen şifrenizi değiştirin ve yöneticinize haber verin.');
    return { recoveryCodes: codes, user };
  }

  async disable(userId: string, password: string, code: string, meta: ClientMeta) {
    const user = await this.loadAdmin(userId);
    if (!user.twoFactorEnabledAt) throw new ConflictException('İki adımlı doğrulama zaten kapalı.');
    await this.checkPassword(user.passwordHash, password);
    if (!(await this.verifyUserCode(user, code))) throw new BadRequestException(INVALID_CODE);
    await this.clear(userId);
    await this.audit.log({ action: 'auth.2fa_disabled', entity: 'User', entityId: userId, userId, ipAddress: meta.ipAddress });
    this.notify(user.email, 'İki adımlı doğrulama kapatıldı', 'Hesabınızda iki adımlı doğrulama kapatıldı. Bu işlemi siz yapmadıysanız hemen şifrenizi değiştirin.');
    return this.status(userId);
  }

  async regenerateRecoveryCodes(userId: string, code: string, meta: ClientMeta) {
    const user = await this.loadAdmin(userId);
    if (!user.twoFactorEnabledAt) throw new ConflictException('Önce iki adımlı doğrulamayı açın.');
    if (!(await this.verifyUserCode(user, code, { allowRecovery: false }))) throw new BadRequestException(INVALID_CODE);
    const codes = this.newRecoveryCodes();
    await this.prisma.$transaction([
      this.prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
      this.prisma.twoFactorRecoveryCode.createMany({ data: codes.map((c) => ({ userId, codeHash: hashToken(normalizeRecovery(c)) })) }),
    ]);
    await this.audit.log({ action: 'auth.2fa_recovery_regenerated', entity: 'User', entityId: userId, userId, ipAddress: meta.ipAddress });
    return { recoveryCodes: codes };
  }

  /** SUPER_ADMIN: telefonunu ve yedek kodlarını kaybeden yöneticinin 2FA'sını sıfırlar */
  async adminReset(actorId: string, targetId: string, ip?: string) {
    if (actorId === targetId) throw new BadRequestException('Kendi doğrulamanızı Hesabım sayfasından yönetin.');
    const target = await this.prisma.user.findUnique({ where: { id: targetId }, select: { email: true, twoFactorEnabledAt: true } });
    if (!target) throw new NotFoundException('Kullanıcı bulunamadı.');
    if (!target.twoFactorEnabledAt) throw new ConflictException('Bu kullanıcıda iki adımlı doğrulama kapalı.');
    await this.clear(targetId);
    await this.prisma.refreshToken.updateMany({ where: { userId: targetId, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.log({ action: 'admin.2fa_reset', entity: 'User', entityId: targetId, userId: actorId, ipAddress: ip });
    this.notify(target.email, 'İki adımlı doğrulamanız sıfırlandı', 'Bir yönetici hesabınızın iki adımlı doğrulamasını sıfırladı. Bir sonraki girişte yeniden kurmanız istenecek.');
    return { success: true };
  }

  private async clear(userId: string) {
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: null, twoFactorPendingSecret: null, twoFactorEnabledAt: null, twoFactorLastStep: null } }),
      this.prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
      this.prisma.twoFactorChallenge.deleteMany({ where: { userId } }),
    ]);
  }

  // ───────────── Giriş ─────────────

  /** Şifre doğru: kod bekleyen kısa ömürlü bir giriş anahtarı verilir (henüz oturum yok) */
  async createChallenge(userId: string) {
    const { token, hash } = newSecureToken();
    await this.prisma.twoFactorChallenge.deleteMany({ where: { OR: [{ userId }, { expiresAt: { lt: new Date() } }] } });
    await this.prisma.twoFactorChallenge.create({ data: { userId, tokenHash: hash, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) } });
    return { twoFactorRequired: true as const, challengeToken: token, expiresIn: CHALLENGE_TTL_MS / 1000 };
  }

  /**
   * Kodu doğrular, başarılıysa kullanıcıyı döner (oturumu AuthService açar).
   * Her hatalı deneme hem bu anahtarın hem hesabın kilitleme sayacına eklenir.
   */
  async verifyChallenge(challengeToken: string, code: string, onFailure: (userId: string, failedCount: number) => Promise<void>) {
    const tokenHash = hashToken(challengeToken);
    // Deneme sayısı ATOMİK artırılır: paralel isteklerle sınır aşılamaz
    const claimed = await this.prisma.twoFactorChallenge.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: CHALLENGE_MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (claimed.count === 0) throw new UnauthorizedException('Doğrulama süresi doldu. Lütfen yeniden giriş yapın.');
    const challenge = await this.prisma.twoFactorChallenge.findUniqueOrThrow({ where: { tokenHash }, include: { user: true } });
    const { user } = challenge;
    if (!user.isActive || user.deletedAt || !user.twoFactorEnabledAt || (user.lockedUntil && user.lockedUntil > new Date())) {
      throw new UnauthorizedException('Doğrulama süresi doldu. Lütfen yeniden giriş yapın.');
    }
    if (!(await this.verifyUserCode(user, code))) {
      await onFailure(user.id, user.failedLoginCount);
      throw new UnauthorizedException(INVALID_CODE);
    }
    // Anahtar tek kullanımlık
    const used = await this.prisma.twoFactorChallenge.updateMany({ where: { id: challenge.id, usedAt: null }, data: { usedAt: new Date() } });
    if (used.count === 0) throw new UnauthorizedException('Doğrulama süresi doldu. Lütfen yeniden giriş yapın.');
    return user;
  }

  /** TOTP kodu veya (izin verilirse) yedek kod */
  private async verifyUserCode(user: { id: string; email: string; twoFactorSecret: string | null }, rawCode: string, opts = { allowRecovery: true }) {
    const code = rawCode.trim();
    if (/^\d{6}$/.test(code)) {
      const secret = user.twoFactorSecret ? this.box.open(user.twoFactorSecret, user.id) : null;
      if (!secret) return false;
      const step = verifyTotp(secret, code);
      if (step === null) return false;
      // Aynı kod (veya daha eski bir kod) ikinci kez kabul edilmez — koşullu güncelleme
      const { count } = await this.prisma.user.updateMany({
        where: { id: user.id, OR: [{ twoFactorLastStep: null }, { twoFactorLastStep: { lt: step } }] },
        data: { twoFactorLastStep: step },
      });
      return count === 1;
    }
    if (!opts.allowRecovery) return false;
    const normalized = normalizeRecovery(code);
    if (!/^[2-9A-HJKMNP-Z]{10}$/.test(normalized)) return false;
    const { count } = await this.prisma.twoFactorRecoveryCode.updateMany({
      where: { userId: user.id, codeHash: hashToken(normalized), usedAt: null },
      data: { usedAt: new Date() },
    });
    if (count !== 1) return false;
    const left = await this.prisma.twoFactorRecoveryCode.count({ where: { userId: user.id, usedAt: null } });
    await this.audit.log({ action: 'auth.2fa_recovery_used', entity: 'User', entityId: user.id, userId: user.id, metaData: { remaining: left } });
    this.notify(
      user.email,
      'Yedek kod kullanıldı',
      `Hesabınıza bir yedek kodla giriş yapıldı. Kalan yedek kod: ${left}.\n${left <= 3 ? 'Hesabım sayfasından yeni yedek kodlar oluşturun.\n' : ''}Bu girişi siz yapmadıysanız hemen şifrenizi değiştirin.`,
    );
    return true;
  }

  private newRecoveryCodes() {
    return Array.from({ length: RECOVERY_COUNT }, () => {
      let s = '';
      for (let i = 0; i < 10; i++) s += RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)];
      return `${s.slice(0, 5)}-${s.slice(5)}`;
    });
  }

  private notify(to: string, subject: string, text: string) {
    this.mail.sendInBackground({ to, subject, text });
  }
}
