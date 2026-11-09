import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { Role } from '../../generated/prisma/client.js';
import type { RequestUser } from '../decorators/current-user.decorator.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

const RANK: Record<Role, number> = { CUSTOMER: 0, ADMIN: 1, SUPER_ADMIN: 2 };

/** JwtAuthGuard'dan SONRA çalışır; @Roles ile istenen en düşük rolü kontrol eder */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const minimum = this.reflector.getAllAndOverride<Role | undefined>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!minimum) return true;
    const user = context.switchToHttp().getRequest<{ user?: RequestUser }>().user;
    if (!user || RANK[user.role] < RANK[minimum]) throw new ForbiddenException('Bu işlem için yetkiniz yok.');
    return true;
  }
}
