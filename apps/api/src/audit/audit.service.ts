import { Injectable, Logger } from '@nestjs/common';

import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type AuditEntry = {
  action: string;
  entity: string;
  entityId: string;
  userId?: string | null;
  ipAddress?: string;
  /** Asla şifre, token vb. sır koymayın */
  metaData?: Prisma.InputJsonValue;
};

/**
 * Güvenlik açısından önemli olayların kaydı (OWASP A09: Logging & Monitoring).
 * Kayıt yazılamazsa asıl işlem bozulmaz, hata loglanır.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId,
          userId: entry.userId ?? null,
          ipAddress: entry.ipAddress,
          metaData: entry.metaData,
        },
      });
    } catch (error) {
      this.logger.error(`Audit kaydı yazılamadı (${entry.action}): ${(error as Error).message}`);
    }
  }
}
