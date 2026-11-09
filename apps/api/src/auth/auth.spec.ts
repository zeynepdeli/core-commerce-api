import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/auth.dto.js';
import { durationToSeconds } from './duration.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { hashToken, newSecureToken } from './secure-token.js';
import { TokensService } from './tokens.service.js';

const config = (values: Record<string, unknown>) => ({ get: (key: string) => values[key] }) as never;
const audit = { log: vi.fn() };

describe('yardımcılar', () => {
  it('süre çevirisi', () => {
    expect(durationToSeconds('15m')).toBe(900);
    expect(durationToSeconds('7d')).toBe(604_800);
    expect(() => durationToSeconds('15 dk')).toThrow();
  });

  it('güvenli token: 43 karakter base64url, DB\'ye yalnızca özeti', () => {
    const { token, hash } = newSecureToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).toBe(hashToken(token));
    expect(hash).not.toContain(token);
  });

  it('kayıt DTO: e-posta normalize, role alanı ve zayıf şifre reddedilir', async () => {
    const dto = plainToInstance(RegisterDto, { email: '  Ayse@Ornek.COM ', password: 'Guclu12345', name: ' Ayşe ' });
    expect(await validate(dto)).toEqual([]);
    expect(dto.email).toBe('ayse@ornek.com');
    const weak = await validate(plainToInstance(RegisterDto, { email: 'a@b.co', password: 'kucuk123', name: 'Ali' }));
    expect(weak.map((e) => e.property)).toContain('password');
    const extra = await validate(plainToInstance(RegisterDto, { email: 'a@b.co', password: 'Guclu12345', name: 'Ali', role: 'ADMIN' }), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(extra.map((e) => e.property)).toContain('role');
  });
});

describe('TokensService.rotate', () => {
  const prisma = {
    refreshToken: { findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
  };
  const jwt = new JwtService({ secret: 'x'.repeat(64) });
  const service = new TokensService(prisma as never, jwt, audit as never, config({ JWT_ACCESS_TTL: '15m', JWT_REFRESH_TTL: '7d' }));
  const user = { id: 'u1', role: 'CUSTOMER', isActive: true, deletedAt: null };

  beforeEach(() => vi.clearAllMocks());

  it('iptal edilmiş token tekrar gelirse tüm aile iptal edilir ve kaydedilir', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({ id: 't1', userId: 'u1', familyId: 'f1', revokedAt: new Date(), expiresAt: new Date(Date.now() + 1e6), user });
    await expect(service.rotate('x', {})).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { familyId: 'f1', revokedAt: null } }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.refresh_token_reuse' }));
  });

  it('eşzamanlı iki kullanımda yalnızca biri kazanır', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({ id: 't1', userId: 'u1', familyId: 'f1', revokedAt: null, expiresAt: new Date(Date.now() + 1e6), user });
    prisma.refreshToken.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValue({ count: 1 });
    await expect(service.rotate('x', {})).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('geçerli token: eskisi iptal, aynı ailede yeni çift', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({ id: 't1', userId: 'u1', familyId: 'f1', revokedAt: null, expiresAt: new Date(Date.now() + 1e6), user });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    const result = await service.rotate('x', { ipAddress: '1.2.3.4' });
    expect(prisma.refreshToken.create.mock.calls[0][0].data).toMatchObject({ familyId: 'f1', userId: 'u1', ipAddress: '1.2.3.4' });
    expect(result.accessTokenExpiresIn).toBe(900);
  });
});

describe('AuthService', () => {
  const prisma = {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    emailVerificationToken: { count: vi.fn().mockResolvedValue(0), updateMany: vi.fn(), create: vi.fn() },
    loginAttempt: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  const password = { hash: vi.fn().mockResolvedValue('$argon2id$hash'), verify: vi.fn(), simulateVerify: vi.fn() };
  const tokens = { issue: vi.fn().mockResolvedValue({ accessToken: 'a' }), revokeAllForUser: vi.fn() };
  const mail = { sendInBackground: vi.fn() };
  const service = new AuthService(
    prisma as never,
    password as never,
    tokens as never,
    mail as never,
    audit as never,
    config({ STOREFRONT_URL: 'https://magaza.com', ADMIN_URL: 'https://admin.magaza.com', GOOGLE_CLIENT_ID: 'id.apps.googleusercontent.com', MAX_FAILED_LOGIN_ATTEMPTS: 5, LOCKOUT_DURATION_MINUTES: 15 }),
    { createChallenge: vi.fn() } as never,
  );

  const googleVerify = () =>
    vi.spyOn((service as unknown as { google: { verifyIdToken: (o: unknown) => Promise<unknown> } }).google, 'verifyIdToken');

  beforeEach(() => vi.clearAllMocks());

  it('kayıtlı e-postayla kayıt: aynı yanıt, yeni kullanıcı yok, sahibine bilgi e-postası', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', deletedAt: null });
    const result = await service.register({ email: 'a@b.co', password: 'Guclu12345', name: 'Ali' }, {});
    expect(result.message).toMatch(/İşleminiz alındı/);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(password.hash).toHaveBeenCalled(); // süre eşitliği
    expect(mail.sendInBackground).toHaveBeenCalledWith(expect.objectContaining({ subject: expect.stringMatching(/zaten/) }));
  });

  it('kullanıcı yoksa da argon2 çalışır (süre eşitliği) ve genel mesaj döner', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.login({ email: 'yok@b.co', password: 'x' }, {})).rejects.toThrow('E-posta veya şifre hatalı.');
    expect(password.simulateVerify).toHaveBeenCalled();
  });

  it('kilitli hesapta doğru şifre bile denenmez', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: 'h', lockedUntil: new Date(Date.now() + 60_000), deletedAt: null });
    await expect(service.login({ email: 'a@b.co', password: 'x' }, {})).rejects.toBeInstanceOf(UnauthorizedException);
    expect(password.verify).not.toHaveBeenCalled();
    expect(password.simulateVerify).toHaveBeenCalled();
  });

  it('Google: doğrulanmamış yerel hesaba bağlanırken o hesabın şifresi ve oturumları silinir (pre-hijacking)', async () => {
    googleVerify().mockResolvedValue({
      getPayload: () => ({ sub: 'g-1', email: 'Kurban@Gmail.com', email_verified: true, name: 'Kurban' }),
    } as never);
    prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'u9', emailVerifiedAt: null });
    prisma.user.update.mockResolvedValue({ id: 'u9', email: 'kurban@gmail.com', name: 'K', role: 'CUSTOMER', isActive: true, deletedAt: null, emailVerifiedAt: new Date() });
    await service.googleLogin('t'.repeat(200), {});
    expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({ googleId: 'g-1', passwordHash: null });
    expect(tokens.revokeAllForUser).toHaveBeenCalledWith('u9');
  });

  it('Google: e-postası doğrulanmamış Google hesabı reddedilir', async () => {
    googleVerify().mockResolvedValue({
      getPayload: () => ({ sub: 'g-2', email: 'x@y.com', email_verified: false }),
    } as never);
    await expect(service.googleLogin('t'.repeat(200), {})).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('Guard\'lar', () => {
  const ctx = (request: object) =>
    ({ switchToHttp: () => ({ getRequest: () => request }), getHandler: () => undefined, getClass: () => undefined }) as unknown as ExecutionContext;

  it('RolesGuard: hiyerarşi (SUPER_ADMIN ⊇ ADMIN), müşteri giremez', () => {
    const reflector = new Reflector();
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue('ADMIN');
    const guard = new RolesGuard(reflector, { requiredFor: () => false } as never);
    expect(guard.canActivate(ctx({ user: { role: 'SUPER_ADMIN' } }))).toBe(true);
    expect(guard.canActivate(ctx({ user: { role: 'ADMIN' } }))).toBe(true);
    expect(() => guard.canActivate(ctx({ user: { role: 'CUSTOMER' } }))).toThrow(ForbiddenException);
  });

  it('RolesGuard: 2FA zorunluysa kurmamış yönetici yönetim uçlarına giremez', () => {
    const reflector = new Reflector();
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue('ADMIN');
    const guard = new RolesGuard(reflector, { requiredFor: (r: string) => r !== 'CUSTOMER' } as never);
    expect(() => guard.canActivate(ctx({ user: { role: 'ADMIN', twoFactorEnabled: false } }))).toThrow(ForbiddenException);
    expect(guard.canActivate(ctx({ user: { role: 'ADMIN', twoFactorEnabled: true } }))).toBe(true);
  });

  it('JwtAuthGuard: şifre değişiminden önce verilmiş token reddedilir', async () => {
    const tokens = { verifyAccess: vi.fn().mockResolvedValue({ sub: 'u1', role: 'CUSTOMER', typ: 'access', iat: Math.floor(Date.now() / 1000) - 60 }) };
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'u1', email: 'a@b.co', name: 'A', role: 'CUSTOMER', isActive: true, deletedAt: null, emailVerifiedAt: null, passwordChangedAt: new Date() }) },
    };
    const guard = new JwtAuthGuard(tokens as never, prisma as never);
    await expect(guard.canActivate(ctx({ headers: { authorization: 'Bearer t' } }))).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
