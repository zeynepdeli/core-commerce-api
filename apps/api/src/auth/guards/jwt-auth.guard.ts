import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import type { RequestUser } from '../decorators/current-user.decorator.js';
import { TokensService } from '../tokens.service.js';

const UNAUTHORIZED = 'Oturum geçersiz veya süresi dolmuş.';

/**
 * Bearer erişim token'ını doğrular ve kullanıcıyı HER İSTEKTE veritabanından
 * okur: askıya alınan, silinen veya rolü düşürülen kullanıcı token süresini
 * beklemeden erişimini kaybeder. Şifre değişikliğinden önce verilmiş token
 * da reddedilir.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokensService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, unknown>; user?: RequestUser }>();
    const header = request.headers.authorization;
    const [scheme, token] = typeof header === 'string' ? header.split(' ') : [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException(UNAUTHORIZED);

    let payload;
    try {
      payload = await this.tokens.verifyAccess(token);
    } catch {
      throw new UnauthorizedException(UNAUTHORIZED);
    }
    if (payload.typ !== 'access' || typeof payload.sub !== 'string') throw new UnauthorizedException(UNAUTHORIZED);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        deletedAt: true,
        emailVerifiedAt: true,
        passwordChangedAt: true,
      },
    });
    if (!user || !user.isActive || user.deletedAt) throw new UnauthorizedException(UNAUTHORIZED);
    if (user.passwordChangedAt && payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
      throw new UnauthorizedException(UNAUTHORIZED);
    }

    request.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerifiedAt !== null,
    };
    return true;
  }
}
