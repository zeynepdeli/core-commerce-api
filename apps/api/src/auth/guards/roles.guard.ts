import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { Role } from '../../generated/prisma/client.js';
import type { RequestUser } from '../decorators/current-user.decorator.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { TWO_FACTOR_SETUP_REQUIRED, TwoFactorService } from '../two-factor/two-factor.service.js';

const RANK: Record<Role, number> = { CUSTOMER: 0, ADMIN: 1, SUPER_ADMIN: 2 };

/** JwtAuthGuard'dan SONRA çalışır; @Roles ile istenen en düşük rolü kontrol eder */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly twoFactor: TwoFactorService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const minimum = this.reflector.getAllAndOverride<Role | undefined>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!minimum) return true;
    const user = context.switchToHttp().getRequest<{ user?: RequestUser }>().user;
    if (!user || RANK[user.role] < RANK[minimum]) throw new ForbiddenException('Bu işlem için yetkiniz yok.');
    // Yönetim uçları: 2FA zorunluysa kurulmadan erişilemez (kurulum /account/2fa altında, serbest)
    if (RANK[minimum] >= RANK.ADMIN && !user.twoFactorEnabled && this.twoFactor.requiredFor(user.role)) {
      throw new ForbiddenException({ statusCode: 403, error: 'Forbidden', code: TWO_FACTOR_SETUP_REQUIRED, message: 'Yönetim paneli için önce iki adımlı doğrulamayı açmalısınız.' });
    }
    return true;
  }
}
