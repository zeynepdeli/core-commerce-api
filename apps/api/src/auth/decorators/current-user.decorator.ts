import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { Role } from '../../generated/prisma/client.js';

export type RequestUser = { id: string; email: string; name: string; role: Role; emailVerified: boolean; twoFactorEnabled?: boolean };

/** JwtAuthGuard'ın doğruladığı kullanıcı (veritabanından güncel haliyle) */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => ctx.switchToHttp().getRequest<{ user: RequestUser }>().user,
);
