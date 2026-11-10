import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { CurrentUser, type RequestUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { clientIp, userAgent } from '../common/client-ip.js';

import { TwoFactorService } from '../auth/two-factor/two-factor.service.js';
import { TokensService } from '../auth/tokens.service.js';

import { ChangePasswordDto, DeleteAccountDto, TwoFactorCodeDto, TwoFactorDisableDto, TwoFactorPasswordDto, UpdateProfileDto } from './account.dto.js';
import { AccountService } from './account.service.js';

const meta = (req: Request) => ({ ipAddress: clientIp(req).ip, userAgent: userAgent(req) });
const STRICT = { default: { limit: 5, ttl: 60_000 } };

/** Giriş yapmış kullanıcının kendi hesabı (her rol) */
@Controller('account')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly twoFactor: TwoFactorService,
    private readonly tokens: TokensService,
  ) {}

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

  // ───── İki adımlı doğrulama (yalnızca yöneticiler) ─────

  @Get('2fa')
  twoFactorStatus(@CurrentUser() user: RequestUser) {
    return this.twoFactor.status(user.id);
  }

  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT)
  twoFactorSetup(@CurrentUser() user: RequestUser, @Body() dto: TwoFactorPasswordDto) {
    return this.twoFactor.startSetup(user.id, dto.password);
  }

  /** Açılınca diğer tüm oturumlar kapanır; bu cihaz için yeni oturum + yedek kodlar döner */
  @Post('2fa/enable')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT)
  async twoFactorEnable(@CurrentUser() user: RequestUser, @Body() dto: TwoFactorCodeDto, @Req() req: Request) {
    const { recoveryCodes, user: u } = await this.twoFactor.enable(user.id, dto.code, meta(req));
    return { recoveryCodes, ...(await this.tokens.issue(u, meta(req))) };
  }

  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT)
  twoFactorDisable(@CurrentUser() user: RequestUser, @Body() dto: TwoFactorDisableDto, @Req() req: Request) {
    return this.twoFactor.disable(user.id, dto.password, dto.code, meta(req));
  }

  @Post('2fa/recovery-codes')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT)
  twoFactorRecovery(@CurrentUser() user: RequestUser, @Body() dto: TwoFactorCodeDto, @Req() req: Request) {
    return this.twoFactor.regenerateRecoveryCodes(user.id, dto.code, meta(req));
  }

  @Delete()
  @Throttle(STRICT)
  remove(@CurrentUser() user: RequestUser, @Body() dto: DeleteAccountDto, @Req() req: Request) {
    return this.account.deleteAccount(user.id, dto.password, meta(req));
  }
}
