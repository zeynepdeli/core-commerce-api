import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

import { AuditService } from '../audit/audit.service.js';
import { isUniqueViolation } from '../common/validators.js';
import type { Env } from '../config/env.validation.js';
import type { Role } from '../generated/prisma/client.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

import type { LoginDto, RegisterDto } from './dto/auth.dto.js';
import { PasswordService } from './password.service.js';
import { hashToken, newSecureToken } from './secure-token.js';
import { type ClientMeta, type IssuedTokens, TokensService } from './tokens.service.js';
import { TwoFactorService } from './two-factor/two-factor.service.js';

const INVALID_CREDENTIALS = 'E-posta veya şifre hatalı.';
const INVALID_LINK = 'Bağlantı geçersiz veya süresi dolmuş. Lütfen yeni bir bağlantı isteyin.';
/** Kayıt/şifre sıfırlama yanıtları, e-postanın kayıtlı olup olmadığını belli etmez */
const GENERIC_SENT = 'İşleminiz alındı. E-posta adresiniz uygunsa birkaç dakika içinde bir bağlantı gelecek.';

const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
/** Bir kullanıcıya saatte en fazla bu kadar doğrulama/sıfırlama e-postası (e-posta bombası koruması) */
const MAX_MAILS_PER_HOUR = 3;

export type AuthUser = { id: string; email: string; name: string; role: Role; emailVerified: boolean };
export type AuthResult = IssuedTokens & { user: AuthUser };
/** Şifre doğru, iki adımlı doğrulama kodu bekleniyor (henüz oturum yok) */
export type TwoFactorPending = { twoFactorRequired: true; challengeToken: string; expiresIn: number };

const toAuthUser = (u: { id: string; email: string; name: string; role: Role; emailVerifiedAt: Date | null }): AuthUser => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  emailVerified: u.emailVerifiedAt !== null,
});

@Injectable()
export class AuthService {
  private readonly storefrontUrl: string;
  private readonly adminUrl: string;
  private readonly googleClientId: string | undefined;
  private readonly google = new OAuth2Client();

  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly tokens: TokensService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Env, true>,
    private readonly twoFactor: TwoFactorService,
  ) {
    this.storefrontUrl = config.get('STOREFRONT_URL', { infer: true }).replace(/\/$/, '');
    this.adminUrl = config.get('ADMIN_URL', { infer: true }).replace(/\/$/, '');
    this.googleClientId = config.get('GOOGLE_CLIENT_ID', { infer: true });
  }

  // ───────────── Kayıt ─────────────

  /**
   * Yanıt, e-postanın daha önce kayıtlı olup olmadığından BAĞIMSIZ olarak
   * aynıdır (user enumeration koruması). Kayıtlı e-postaya "zaten hesabınız
   * var" bilgisi e-postayla gider; yalnızca adresin sahibi öğrenir.
   */
  async register(dto: RegisterDto, meta: ClientMeta) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, deletedAt: true },
    });

    // İki dalda da argon2 çalışır: yanıt süresi farkı da bilgi sızdırmasın
    const passwordHash = await this.password.hash(dto.password);

    if (existing) {
      if (!existing.deletedAt) {
        this.mail.sendInBackground({
          to: dto.email,
          subject: 'Bu e-posta ile zaten bir hesabınız var',
          text: [
            'Merhaba,',
            '',
            'Bu e-posta adresiyle yeni bir hesap oluşturulmak istendi, ancak adresinize ait bir hesap zaten var.',
            `Şifrenizi hatırlamıyorsanız buradan sıfırlayabilirsiniz: ${this.storefrontUrl}/sifremi-unuttum`,
            '',
            'Bu isteği siz yapmadıysanız bu e-postayı dikkate almayın.',
          ].join('\n'),
        });
      }
      return { message: GENERIC_SENT };
    }

    let user: { id: string };
    try {
      user = await this.prisma.user.create({
        data: { email: dto.email, name: dto.name, passwordHash, signupMethod: 'LOCAL' },
        select: { id: true },
      });
    } catch (error) {
      // Aynı anda iki kayıt isteği: ikincisi de genel yanıtı alır
      if (isUniqueViolation(error)) return { message: GENERIC_SENT };
      throw error;
    }

    await this.sendVerificationEmail(user.id, dto.email);
    await this.audit.log({ action: 'auth.register', entity: 'User', entityId: user.id, userId: user.id, ipAddress: meta.ipAddress });
    return { message: GENERIC_SENT };
  }

  // ───────────── Giriş ─────────────

  async login(dto: LoginDto, meta: ClientMeta): Promise<AuthResult | TwoFactorPending> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // A: kullanıcı yok — sahte doğrulama ile süre eşitlenir
    if (!user || user.deletedAt) {
      await this.password.simulateVerify();
      await this.recordLoginAttempt(dto.email, meta, false);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    // B: hesap kilitli — süre farkı "bu e-posta var ve kilitli" bilgisini sızdırmasın
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.password.simulateVerify();
      await this.recordLoginAttempt(dto.email, meta, false);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    // C: yalnızca Google ile kayıtlı (yerel şifresi yok)
    if (!user.passwordHash) {
      await this.password.simulateVerify();
      await this.recordLoginAttempt(dto.email, meta, false);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    // D: gerçek şifre doğrulama
    if (!(await this.password.verify(user.passwordHash, dto.password))) {
      await this.handleFailedLogin(user.id, user.failedLoginCount, meta);
      await this.recordLoginAttempt(dto.email, meta, false);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    // Şifre doğru ama hesap askıda: artık bunu söylemek bilgi sızdırmaz
    if (!user.isActive) {
      await this.recordLoginAttempt(dto.email, meta, false);
      throw new ForbiddenException('Hesabınız kullanıma kapatılmış. Destek ile iletişime geçin.');
    }

    // İki adımlı doğrulama açıksa oturum ancak kodla açılır. Hatalı giriş sayacı
    // burada SIFIRLANMAZ: şifreyi bilen biri kodu deneyerek kilidi atlatamasın.
    if (user.twoFactorEnabledAt) return this.twoFactor.createChallenge(user.id);

    // E: başarılı giriş
    await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
    await this.recordLoginAttempt(dto.email, meta, true);

    const tokens = await this.tokens.issue(user, meta);
    return { ...tokens, user: toAuthUser(user) };
  }

  refresh(refreshToken: string, meta: ClientMeta): Promise<IssuedTokens> {
    return this.tokens.rotate(refreshToken, meta);
  }

  async logout(refreshToken: string) {
    await this.tokens.revokeByToken(refreshToken);
    return { success: true };
  }

  // ───────────── E-posta doğrulama ─────────────

  async verifyEmail(token: string, meta: ClientMeta) {
    const record = await this.prisma.emailVerificationToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!record || record.usedAt || record.expiresAt <= new Date()) throw new BadRequestException(INVALID_LINK);

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
    ]);
    await this.audit.log({ action: 'auth.email_verified', entity: 'User', entityId: record.userId, userId: record.userId, ipAddress: meta.ipAddress });
    return { success: true };
  }

  async resendVerification(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, emailVerifiedAt: true, isActive: true, deletedAt: true },
    });
    if (user && !user.emailVerifiedAt && user.isActive && !user.deletedAt) {
      await this.sendVerificationEmail(user.id, user.email);
    }
    return { message: GENERIC_SENT };
  }

  // ───────────── Şifre sıfırlama ─────────────

  async forgotPassword(email: string, meta: ClientMeta) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true, isActive: true, deletedAt: true },
    });
    if (!user || !user.isActive || user.deletedAt) return { message: GENERIC_SENT };
    // Yöneticinin bağlantısı admin paneline, müşterininki mağazaya gider
    const resetBase = user.role === 'CUSTOMER' ? this.storefrontUrl : this.adminUrl;

    const since = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await this.prisma.passwordResetToken.count({ where: { userId: user.id, createdAt: { gte: since } } });
    if (recent >= MAX_MAILS_PER_HOUR) return { message: GENERIC_SENT };

    const { token, hash } = newSecureToken();
    await this.prisma.$transaction([
      // Önceki kullanılmamış bağlantılar geçersiz olur
      this.prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
      this.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS) },
      }),
    ]);

    this.mail.sendInBackground({
      to: user.email,
      subject: 'Şifre sıfırlama',
      text: [
        'Merhaba,',
        '',
        'Şifrenizi sıfırlamak için aşağıdaki bağlantıyı açın (30 dakika geçerlidir):',
        // Token adresin # kısmında: sunucu loglarına ve Referer başlığına düşmez
        user.role === 'CUSTOMER' ? `${resetBase}/sifre-sifirla#token=${token}` : `${resetBase}/reset-password#token=${token}`,
        '',
        'Bu isteği siz yapmadıysanız bu e-postayı dikkate almayın; şifreniz değişmez.',
      ].join('\n'),
    });
    await this.audit.log({ action: 'auth.password_reset_requested', entity: 'User', entityId: user.id, userId: user.id, ipAddress: meta.ipAddress });
    return { message: GENERIC_SENT };
  }

  async resetPassword(token: string, newPassword: string, meta: ClientMeta) {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { select: { id: true, email: true, isActive: true, deletedAt: true } } },
    });
    if (!record || record.usedAt || record.expiresAt <= new Date() || !record.user.isActive || record.user.deletedAt) {
      throw new BadRequestException(INVALID_LINK);
    }

    const passwordHash = await this.password.hash(newPassword);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({ where: { userId: record.userId, usedAt: null }, data: { usedAt: now } }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: {
          passwordHash,
          passwordChangedAt: now,
          failedLoginCount: 0,
          lockedUntil: null,
        },
      }),
      // Bağlantı e-postaya geldiği için adres sahipliği kanıtlanmış olur
      this.prisma.user.updateMany({ where: { id: record.userId, emailVerifiedAt: null }, data: { emailVerifiedAt: now } }),
    ]);
    // Tüm cihazlardaki oturumlar kapanır (şifre çalındıysa saldırgan da düşer)
    await this.tokens.revokeAllForUser(record.userId);

    this.mail.sendInBackground({
      to: record.user.email,
      subject: 'Şifreniz değiştirildi',
      text: 'Hesabınızın şifresi az önce değiştirildi ve tüm cihazlardaki oturumlar kapatıldı.\nBu işlemi siz yapmadıysanız hemen destek ile iletişime geçin.',
    });
    await this.audit.log({ action: 'auth.password_reset', entity: 'User', entityId: record.userId, userId: record.userId, ipAddress: meta.ipAddress });
    return { success: true };
  }

  // ───────────── Google ile giriş ─────────────

  /**
   * Mağaza, Google Identity Services ile aldığı ID token'ı gönderir.
   * İmza, süre ve hedef kitle (audience = GOOGLE_CLIENT_ID) Google
   * kütüphanesiyle doğrulanır; doğrulanmamış Google e-postası kabul edilmez.
   */
  async googleLogin(idToken: string, meta: ClientMeta): Promise<AuthResult | TwoFactorPending> {
    if (!this.googleClientId) throw new NotFoundException('Google ile giriş bu mağazada kapalı.');

    let payload: { sub?: string; email?: string; email_verified?: boolean; name?: string } | undefined;
    try {
      const ticket = await this.google.verifyIdToken({ idToken, audience: this.googleClientId });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Google oturumu doğrulanamadı.');
    }
    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      throw new UnauthorizedException('Google hesabınızın e-postası doğrulanmamış.');
    }

    const email = payload.email.trim().toLowerCase();
    const name = (payload.name?.trim() || email.split('@')[0]).slice(0, 100);
    const now = new Date();

    let user = await this.prisma.user.findUnique({ where: { googleId: payload.sub } });

    if (!user) {
      const byEmail = await this.prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        // Hesap bağlama. Önceden ele geçirme (pre-hijacking) koruması: e-postası
        // DOĞRULANMAMIŞ yerel hesabı başkası açmış olabilir. Google adres
        // sahipliğini kanıtladığı için o hesabın şifresi ve oturumları silinir.
        const unverified = byEmail.emailVerifiedAt === null;
        user = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: {
            googleId: payload.sub,
            emailVerifiedAt: byEmail.emailVerifiedAt ?? now,
            ...(unverified ? { passwordHash: null, passwordChangedAt: now } : {}),
          },
        });
        if (unverified) await this.tokens.revokeAllForUser(byEmail.id);
        await this.audit.log({
          action: 'auth.google_linked',
          entity: 'User',
          entityId: byEmail.id,
          userId: byEmail.id,
          ipAddress: meta.ipAddress,
          metaData: { clearedUnverifiedPassword: unverified },
        });
      } else {
        user = await this.prisma.user.create({
          data: { email, name, googleId: payload.sub, signupMethod: 'GOOGLE', emailVerifiedAt: now },
        });
        await this.audit.log({ action: 'auth.register', entity: 'User', entityId: user.id, userId: user.id, ipAddress: meta.ipAddress, metaData: { method: 'google' } });
      }
    }

    if (user.deletedAt) throw new UnauthorizedException('Bu hesap kapatılmış.');
    if (!user.isActive) throw new ForbiddenException('Hesabınız kullanıma kapatılmış. Destek ile iletişime geçin.');

    if (user.twoFactorEnabledAt) return this.twoFactor.createChallenge(user.id);
    await this.recordLoginAttempt(email, meta, true);
    const tokens = await this.tokens.issue(user, meta);
    return { ...tokens, user: toAuthUser(user) };
  }

  /** Girişin 2. adımı: uygulamadaki 6 haneli kod veya yedek kod */
  async verifyTwoFactor(challengeToken: string, code: string, meta: ClientMeta): Promise<AuthResult> {
    const user = await this.twoFactor.verifyChallenge(challengeToken, code, async (userId, failed) => {
      await this.handleFailedLogin(userId, failed, meta);
      await this.audit.log({ action: 'auth.2fa_failed', entity: 'User', entityId: userId, userId, ipAddress: meta.ipAddress });
    });
    await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
    await this.recordLoginAttempt(user.email, meta, true);
    const tokens = await this.tokens.issue(user, meta);
    return { ...tokens, user: toAuthUser(user) };
  }

  // ───────────── Yardımcılar ─────────────

  private async sendVerificationEmail(userId: string, email: string) {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await this.prisma.emailVerificationToken.count({ where: { userId, createdAt: { gte: since } } });
    if (recent >= MAX_MAILS_PER_HOUR) return;

    const { token, hash } = newSecureToken();
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } }),
      this.prisma.emailVerificationToken.create({
        data: { userId, tokenHash: hash, expiresAt: new Date(Date.now() + EMAIL_VERIFY_TTL_MS) },
      }),
    ]);
    this.mail.sendInBackground({
      to: email,
      subject: 'E-posta adresinizi doğrulayın',
      text: [
        'Hoş geldiniz!',
        '',
        'Hesabınızı etkinleştirmek için aşağıdaki bağlantıyı açın (24 saat geçerlidir):',
        `${this.storefrontUrl}/eposta-dogrula#token=${token}`,
        '',
        'Bu hesabı siz oluşturmadıysanız bu e-postayı dikkate almayın.',
      ].join('\n'),
    });
  }

  private async handleFailedLogin(userId: string, currentCount: number, meta: ClientMeta): Promise<void> {
    const maxAttempts = this.config.get('MAX_FAILED_LOGIN_ATTEMPTS', { infer: true });
    const lockoutMinutes = this.config.get('LOCKOUT_DURATION_MINUTES', { infer: true });
    const newCount = currentCount + 1;
    const shouldLock = newCount >= maxAttempts;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: newCount,
        lockedUntil: shouldLock ? new Date(Date.now() + lockoutMinutes * 60 * 1000) : undefined,
      },
    });
    if (shouldLock) {
      await this.audit.log({
        action: 'auth.account_locked',
        entity: 'User',
        entityId: userId,
        userId,
        ipAddress: meta.ipAddress,
        metaData: { failedLoginCount: newCount, lockoutMinutes },
      });
    }
  }

  private async recordLoginAttempt(email: string, meta: ClientMeta, success: boolean): Promise<void> {
    await this.prisma.loginAttempt.create({
      data: { email: email.slice(0, 254), ipAddress: meta.ipAddress ?? 'unknown', success },
    });
  }
}
