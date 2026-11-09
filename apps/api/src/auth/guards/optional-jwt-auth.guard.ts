import { type ExecutionContext, Injectable } from '@nestjs/common';

import { JwtAuthGuard } from './jwt-auth.guard.js';

/**
 * Giriş isteğe bağlı uçlar (ör. sepet): Authorization başlığı yoksa misafir
 * olarak devam eder; VARSA ve geçersizse 401 döner (sessizce misafire düşmez,
 * böylece süresi dolmuş oturum fark edilir).
 */
@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, unknown> }>();
    if (request.headers.authorization === undefined) return true;
    return super.canActivate(context);
  }
}
