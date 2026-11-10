import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';

import { AuditService } from '../audit/audit.service.js';
import type { Env } from '../config/env.validation.js';
import type { Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

import { durationToSeconds } from './duration.js';
import { hashToken, newSecureToken } from './secure-token.js';

export type ClientMeta = { ipAddress?: string; userAgent?: string };

export type IssuedTokens = {
  accessToken: string;
  /** saniye */
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
};

/** ims: verilme anı (milisaniye). iat saniye hassasiyetinde; aynı saniyede kapatılan oturumu ayırt etmek için */
export type AccessPayload = { sub: string; role: Role; typ: 'access'; iat: number; exp: number; ims?: number };

const INVALID = 'Oturum geçersiz veya süresi dolmuş. Lütfen tekrar giriş yapın.';

@Injectable()
export class TokensService {
  private readonly accessTtl: number;
  private readonly refreshTtl: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    config: ConfigService<Env, true>,
  ) {
    this.accessTtl = durationToSeconds(config.get('JWT_ACCESS_TTL', { infer: true }));
    this.refreshTtl = durationToSeconds(config.get('JWT_REFRESH_TTL', { infer: true }));
  }

  /** Yeni oturum: yeni bir token ailesi (familyId) başlatır */
  issue(user: { id: string; role: Role }, meta: ClientMeta): Promise<IssuedTokens> {
    return this.createPair(user, randomUUID(), meta);
  }

  /**
   * Refresh token rotation: her kullanımda eskisi iptal edilir, yenisi verilir.
   * İPTAL EDİLMİŞ bir token tekrar gelirse token çalınmış demektir (saldırgan
   * veya gerçek kullanıcı eski kopyayı kullanıyor) → tüm aile iptal edilir.
   */
  async rotate(refreshToken: string, meta: ClientMeta): Promise<IssuedTokens> {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, role: true, isActive: true, deletedAt: true } } },
    });
    if (!stored) throw new UnauthorizedException(INVALID);

    if (stored.revokedAt) {
      await this.revokeFamily(stored.familyId);
      await this.audit.log({
        action: 'auth.refresh_token_reuse',
        entity: 'User',
        entityId: stored.userId,
        userId: stored.userId,
        ipAddress: meta.ipAddress,
        metaData: { familyId: stored.familyId },
      });
      throw new UnauthorizedException(INVALID);
    }

    if (stored.expiresAt <= new Date() || !stored.user.isActive || stored.user.deletedAt) {
      await this.revokeFamily(stored.familyId);
      throw new UnauthorizedException(INVALID);
    }

    const next = newSecureToken();
    // Koşullu iptal: aynı token iki istekte eşzamanlı kullanılırsa yalnızca
    // biri kazanır; diğeri "yeniden kullanım" sayılır.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date(), replacedByTokenHash: next.hash },
    });
    if (count === 0) {
      await this.revokeFamily(stored.familyId);
      throw new UnauthorizedException(INVALID);
    }

    return this.createPair(stored.user, stored.familyId, meta, next);
  }

  /** Çıkış: bu cihazın oturum zinciri kapanır. Geçersiz token sessizce yok sayılır. */
  async revokeByToken(refreshToken: string): Promise<void> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      select: { familyId: true },
    });
    if (stored) await this.revokeFamily(stored.familyId);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  verifyAccess(token: string): Promise<AccessPayload> {
    return this.jwt.verifyAsync<AccessPayload>(token, { algorithms: ['HS256'] });
  }

  private async revokeFamily(familyId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async createPair(
    user: { id: string; role: Role },
    familyId: string,
    meta: ClientMeta,
    refresh = newSecureToken(),
  ): Promise<IssuedTokens> {
    const expiresAt = new Date(Date.now() + this.refreshTtl * 1000);
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: refresh.hash,
        userId: user.id,
        familyId,
        expiresAt,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, role: user.role, typ: 'access', ims: Date.now() },
      { expiresIn: this.accessTtl, algorithm: 'HS256' },
    );

    return {
      accessToken,
      accessTokenExpiresIn: this.accessTtl,
      refreshToken: refresh.token,
      refreshTokenExpiresAt: expiresAt.toISOString(),
    };
  }
}
