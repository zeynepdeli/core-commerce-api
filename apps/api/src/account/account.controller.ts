import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { CurrentUser, type RequestUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { clientIp, userAgent } from '../common/client-ip.js';

import { ChangePasswordDto, DeleteAccountDto, UpdateProfileDto } from './account.dto.js';
import { AccountService } from './account.service.js';

const meta = (req: Request) => ({ ipAddress: clientIp(req).ip, userAgent: userAgent(req) });
const STRICT = { default: { limit: 5, ttl: 60_000 } };

/** Giriş yapmış kullanıcının kendi hesabı (her rol) */
@Controller('account')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return this.account.me(user.id);
  }

  @Patch('me')
  update(@CurrentUser() user: RequestUser, @Body() dto: UpdateProfileDto) {
    return this.account.updateProfile(user.id, dto.name);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT)
  changePassword(@CurrentUser() user: RequestUser, @Body() dto: ChangePasswordDto, @Req() req: Request) {
    return this.account.changePassword(user.id, dto.currentPassword, dto.newPassword, meta(req));
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  logoutAll(@CurrentUser() user: RequestUser, @Req() req: Request) {
    return this.account.logoutAll(user.id, meta(req));
  }

  @Delete()
  @Throttle(STRICT)
  remove(@CurrentUser() user: RequestUser, @Body() dto: DeleteAccountDto, @Req() req: Request) {
    return this.account.deleteAccount(user.id, dto.password, meta(req));
  }
}
