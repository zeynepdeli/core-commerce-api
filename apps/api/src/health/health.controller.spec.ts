import { ServiceUnavailableException } from '@nestjs/common';

import type { PrismaService } from '../prisma/prisma.service.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('veritabanı yanıt veriyorsa ok', async () => {
    const prisma = { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) };
    await expect(new HealthController(prisma as unknown as PrismaService).check()).resolves.toEqual({ status: 'ok' });
  });

  it('veritabanı yoksa 503 ve ayrıntı sızdırmaz', async () => {
    const prisma = { $queryRaw: vi.fn().mockRejectedValue(new Error('password authentication failed for user "x"')) };
    const error = await new HealthController(prisma as unknown as PrismaService).check().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(JSON.stringify((error as ServiceUnavailableException).getResponse())).not.toContain('password');
  });
});
