import { Body, Controller, HttpCode, HttpStatus, Logger, NotFoundException, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { IsOptional, Matches } from 'class-validator';
import type { Request, Response } from 'express';

import { CurrentUser, type RequestUser } from '../auth/decorators/current-user.decorator.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import { clientIp } from '../common/client-ip.js';
import type { Env } from '../config/env.validation.js';

import { PaymentsService } from './payments.service.js';

export class InitPaymentDto {
  @Matches(/^\d{4}-[0-9A-Z]{8}$/, { message: 'Sipariş numarası geçersiz.' })
  orderNumber!: string;

  /** Misafir siparişinde zorunlu (sipariş oluşturulurken bir kez verilen anahtar) */
  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]{43}$/, { message: 'Sipariş bulunamadı.' })
  accessToken?: string;
}

const TOKEN = /^[A-Za-z0-9-]{10,128}$/;

@Controller('payments/iyzico')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);
  private readonly resultUrl: string;

  constructor(
    private readonly payments: PaymentsService,
    config: ConfigService<Env, true>,
  ) {
    this.resultUrl = `${config.get('STOREFRONT_URL', { infer: true }).replace(/\/$/, '')}/siparis/sonuc`;
  }

  @Post('init')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  init(@CurrentUser() user: RequestUser | undefined, @Body() dto: InitPaymentDto, @Req() req: Request) {
    if (!user && !dto.accessToken) throw new NotFoundException('Sipariş bulunamadı.');
    const owner = user ? { userId: user.id } : { guestAccessToken: dto.accessToken as string };
    return this.payments.init(dto.orderNumber, owner, clientIp(req).ip);
  }

  /**
   * iyzico ödeme sonrası müşterinin tarayıcısını buraya POST eder (form-urlencoded, yalnızca token).
   * Doğrudan gelen istek hiçbir şey kanıtlamaz: sonuç sunucu-sunucu sorgulanır.
   * Yanıt her durumda mağazanın sonuç sayfasına yönlendirmedir (iç ayrıntı sızdırılmaz).
   */
  @Post('callback')
  @SkipThrottle({ long: true })
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async callback(@Req() req: Request, @Res() res: Response) {
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    let target = `${this.resultUrl}?durum=hata`;
    if (TOKEN.test(token)) {
      try {
        const result = await this.payments.complete(token);
        if (result) {
          const q = new URLSearchParams({ siparis: result.orderNumber, durum: result.ok ? 'basarili' : 'basarisiz' });
          if (!result.ok && result.reason) q.set('neden', result.reason.slice(0, 200));
          target = `${this.resultUrl}?${q}`;
        }
      } catch (error) {
        this.logger.error(`Ödeme sonucu işlenemedi: ${(error as Error).message}`);
      }
    }
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(303, target);
  }
}
