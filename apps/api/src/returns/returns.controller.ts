import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { CurrentUser, type RequestUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { hashToken } from '../auth/secure-token.js';
import { clientIp } from '../common/client-ip.js';

import { AdminReturnsQueryDto, CreateReturnDto, GuestCreateReturnDto, GuestReturnAuthDto, ReturnDecisionDto, ReturnReceiveDto, ReturnRefundDto } from './returns.dto.js';
import { ReturnsService } from './returns.service.js';

const ORDER_NUMBER = /^\d{4}-[0-9A-Z]{8}$/;
const checkNo = (n: string) => {
  if (!ORDER_NUMBER.test(n)) throw new NotFoundException('Sipariş bulunamadı.');
  return n;
};

/** Üye: kendi siparişi için iade talebi */
@Controller('account/orders/:orderNumber/returns')
@UseGuards(JwtAuthGuard)
export class AccountReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(@CurrentUser() user: RequestUser, @Param('orderNumber') orderNumber: string, @Body() dto: CreateReturnDto) {
    return this.returns.create({ userId: user.id }, checkNo(orderNumber), dto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUser() user: RequestUser, @Param('orderNumber') orderNumber: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.returns.cancelByCustomer({ userId: user.id }, checkNo(orderNumber), id);
  }
}

/** Misafir: sipariş no + erişim anahtarı (gövdede; URL/loglara düşmesin) */
@Controller('orders/returns')
export class GuestReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(@Body() dto: GuestCreateReturnDto) {
    const { orderNumber, accessToken, ...rest } = dto;
    return this.returns.create({ guestAccessTokenHash: hashToken(accessToken) }, orderNumber, rest);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: GuestReturnAuthDto) {
    return this.returns.cancelByCustomer({ guestAccessTokenHash: hashToken(dto.accessToken) }, dto.orderNumber, id);
  }
}

@Controller('admin/returns')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Get()
  list(@Query() query: AdminReturnsQueryDto) {
    return this.returns.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.returns.get(id);
  }

  @Patch(':id/decision')
  decide(@CurrentUser() actor: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReturnDecisionDto, @Req() req: Request) {
    return this.returns.decide(id, dto.decision, dto.note, actor.id, clientIp(req).ip);
  }

  @Post(':id/receive')
  @HttpCode(HttpStatus.OK)
  receive(@CurrentUser() actor: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReturnReceiveDto, @Req() req: Request) {
    return this.returns.receive(id, dto.restock, actor.id, clientIp(req).ip);
  }

  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  refund(@CurrentUser() actor: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReturnRefundDto, @Req() req: Request) {
    return this.returns.refund(id, dto.manual === true, actor.id, clientIp(req).ip);
  }
}
