import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import type { EnvConfig } from '../config/env.validation';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService<EnvConfig, true>) {
    const adapter = new PrismaPg({
      connectionString: config.get('DATABASE_URL', { infer: true }),
      max: config.get('DB_POOL_MAX', { infer: true }),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    super({ adapter });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Veritabanı bağlantısı kuruldu');
    } catch (error) {
      this.logger.error('Veritabanına bağlanılamadı', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Veritabanı bağlantısı kapatıldı');
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
