import { BadRequestException, Body, Controller, Get, Header, HttpCode, HttpStatus, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { CurrentUser, type RequestUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { clientIp } from '../common/client-ip.js';
import { PrismaService } from '../prisma/prisma.service.js';

import { CartRemindersService } from './cart-reminders.service.js';
import { ConsentsService } from './consents.service.js';
import { ConsentUpdateDto, StockAlertDto, UnsubscribeDto } from './marketing.dto.js';
import { ProductFeedService } from './product-feed.service.js';
import { StockAlertsService } from './stock-alerts.service.js';

@Controller()
export class MarketingController {
  constructor(
    private readonly stockAlerts: StockAlertsService,
    private readonly consents: ConsentsService,
    private readonly feed: ProductFeedService,
  ) {}

  /** "Gelince haber ver" */
  @Post('shop/stock-alerts')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 }, long: { limit: 50, ttl: 3_600_000 } })
  stockAlert(@CurrentUser() user: RequestUser | undefined, @Body() dto: StockAlertDto) {
    const email = user?.email ?? dto.email;
    if (!email) throw new BadRequestException('E-posta adresinizi girin.');
    return this.stockAlerts.subscribe(dto.variantId, email, user?.id);
  }

  /** E-postadaki tek tıkla ret bağlantısı (mağaza sayfası POST eder) */
  @Post('marketing/unsubscribe')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  unsubscribe(@Body() dto: UnsubscribeDto, @Req() req: Request) {
    return this.consents.unsubscribe(dto.token, clientIp(req).ip);
  }

  /** Google Merchant Center ürün akışı (herkese açık bilgiler) */
  @Get('feeds/google.xml')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async google(@Req() req: Request, @Res() res: Response) {
    const { body, etag } = await this.feed.google();
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=600');
    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }
    res.type('application/xml; charset=utf-8').send(body);
  }
}

/** Üyenin ticari ileti izinleri */
@Controller('account/consents')
@UseGuards(JwtAuthGuard)
export class AccountConsentsController {
  constructor(private readonly consents: ConsentsService) {}

  @Get()
  get(@CurrentUser() user: RequestUser) {
    return this.consents.status(user.id, user.email);
  }

  @Put()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  set(@CurrentUser() user: RequestUser, @Body() dto: ConsentUpdateDto, @Req() req: Request) {
    return this.consents.set(user.id, user.email, dto, clientIp(req).ip);
  }
}

@Controller('admin/marketing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminMarketingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly feed: ProductFeedService,
    private readonly stockAlerts: StockAlertsService,
    private readonly reminders: CartRemindersService,
  ) {}

  /** Zamanlanmış işleri hemen çalıştır (ör. büyük stok girişinden sonra) */
  @Post('run')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async runNow() {
    return { stockAlertsSent: await this.stockAlerts.run(), cartRemindersSent: await this.reminders.run() };
  }

  /** Bekleyen stok talepleri (en çok istenen), son 30 gün gönderimler, akış durumu */
  @Get()
  @Header('Cache-Control', 'no-store')
  async overview() {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [demand, sent, recovered, optIns] = await Promise.all([
      this.prisma.$queryRaw<{ variantId: string; product: string; variant: string; waiting: number; stock: number; trackStock: boolean }[]>`
        SELECT a."variantId" AS "variantId", p.name AS product, v.name AS variant, count(*)::int AS waiting, v.stock, v."trackStock" AS "trackStock"
        FROM "StockAlert" a JOIN "ProductVariant" v ON v.id = a."variantId" JOIN "Product" p ON p.id = v."productId"
        WHERE a."notifiedAt" IS NULL AND v."deletedAt" IS NULL AND p."deletedAt" IS NULL
        GROUP BY a."variantId", p.name, v.name, v.stock, v."trackStock"
        ORDER BY count(*) DESC LIMIT 20`,
      this.prisma.marketingMessage.groupBy({ by: ['type'], where: { sentAt: { gte: since } }, _count: { _all: true } }),
      // Hatırlatmadan sonraki 7 gün içinde ödenen sipariş
      this.prisma.$queryRaw<{ n: number; revenue: string }[]>`
        SELECT count(DISTINCT o.id)::int AS n, coalesce(sum(o.total), 0)::text AS revenue
        FROM "MarketingMessage" m JOIN "Order" o ON o."userId" = m."userId"
          AND o."paidAt" IS NOT NULL AND o."createdAt" > m."sentAt" AND o."createdAt" < m."sentAt" + interval '7 days'
        WHERE m.type = 'CART_REMINDER' AND m."sentAt" >= ${since}`,
      this.prisma.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM (
          SELECT DISTINCT ON (lower(email)) granted FROM "ConsentRecord" WHERE channel = 'EMAIL' ORDER BY lower(email), "createdAt" DESC
        ) t WHERE granted`,
    ]);
    const count = (t: string) => sent.find((x) => x.type === t)?._count._all ?? 0;
    return {
      stockDemand: demand,
      last30Days: { stockAlertsSent: count('STOCK_ALERT'), cartRemindersSent: count('CART_REMINDER'), recoveredOrders: recovered[0].n, recoveredRevenue: recovered[0].revenue },
      emailOptIns: optIns[0].n,
      feedPath: '/feeds/google.xml',
    };
  }

  /** Akış önbelleğini hemen yenile (ürünleri toplu güncelledikten sonra) */
  @Post('feed/refresh')
  @HttpCode(HttpStatus.OK)
  refresh() {
    this.feed.invalidate();
    return { success: true };
  }
}
