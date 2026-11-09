import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

import { clientIp } from './client-ip.js';

/** Hız sınırı gerçek ziyaretçi IP'sine göre sayılır (bkz. clientIp) */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, any>): Promise<string> {
    const { ip, viaFrontend } = clientIp(req);
    return Promise.resolve(viaFrontend ? `web:${ip}` : ip);
  }
}
