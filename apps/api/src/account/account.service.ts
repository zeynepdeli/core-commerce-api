import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service.js';
import { PasswordService } from '../auth/password.service.js';
import { type ClientMeta, TokensService } from '../auth/tokens.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const PROFILE_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  signupMethod: true,
  emailVerifiedAt: true,
  passwordHash: true,
  googleId: true,
  createdAt: true,
} as const;

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly tokens: TokensService,
    private readonly audit: AuditService,
  ) {}

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: PROFILE_SELECT });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı.');
    // Şifre özeti ve Google kimliği ASLA dışarı verilmez; yalnızca var/yok bilgisi
    const { passwordHash, googleId, emailVerifiedAt, ...rest } = user;
    return { ...rest, emailVerified: emailVerifiedAt !== null, hasPassword: passwordHash !== null, googleLinked: googleId !== null };
  }

  async updateProfile(userId: string, name: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { name } });
    return this.me(userId);
  }

  /** Şifre değişince TÜM oturumlar kapanır; bu cihaz için yeni oturum verilir */
  async changePassword(userId: string, currentPassword: string, newPassword: string, meta: ClientMeta) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, passwordHash: true } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı.');
    if (!user.passwordHash) {
      throw new BadRequestException("Hesabınızda şifre yok (Google ile giriş). Şifre belirlemek için 'Şifremi unuttum' adımını kullanın.");
    }
    if (!(await this.password.verify(user.passwordHash, currentPassword))) {
      throw new UnauthorizedException('Mevcut şifre hatalı.');
    }
    if (currentPassword === newPassword) throw new BadRequestException('Yeni şifre mevcut şifreden farklı olmalı.');

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await this.password.hash(newPassword), passwordChangedAt: new Date() },
    });
    await this.tokens.revokeAllForUser(userId);
    await this.audit.log({ action: 'account.password_changed', entity: 'User', entityId: userId, userId, ipAddress: meta.ipAddress });
    return this.tokens.issue(user, meta);
  }

  async logoutAll(userId: string, meta: ClientMeta) {
    await this.tokens.revokeAllForUser(userId);
    await this.audit.log({ action: 'account.logout_all', entity: 'User', entityId: userId, userId, ipAddress: meta.ipAddress });
    return { success: true };
  }

  /**
   * Hesap kapatma (KVKK/GDPR talebi). Hesap hemen kullanılamaz hale gelir;
   * siparişler yasal saklama süresince korunur. Kalıcı anonimleştirme
   * zamanlanmış bir iş olarak ayrıca yapılmalıdır.
   */
  async deleteAccount(userId: string, password: string | undefined, meta: ClientMeta) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true, role: true } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı.');
    if (user.role !== 'CUSTOMER') throw new BadRequestException('Yönetici hesapları buradan kapatılamaz.');
    if (user.passwordHash && !(password && (await this.password.verify(user.passwordHash, password)))) {
      throw new UnauthorizedException('Şifre hatalı.');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date(), isActive: false } });
    await this.tokens.revokeAllForUser(userId);
    await this.audit.log({ action: 'account.deleted', entity: 'User', entityId: userId, userId, ipAddress: meta.ipAddress });
    return { success: true };
  }
}
