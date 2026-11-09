import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { clientIp, userAgent } from '../common/client-ip.js';

import { AuthService } from './auth.service.js';
import {
  EmailDto,
  GoogleLoginDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/auth.dto.js';
import type { ClientMeta } from './tokens.service.js';

const meta = (req: Request): ClientMeta => ({ ipAddress: clientIp(req).ip, userAgent: userAgent(req) });

// Kaba kuvvet ve e-posta bombasına karşı IP başına sıkı sınırlar.
// (Hesap bazında kilitleme ayrıca AuthService'te.)
const STRICT = { default: { limit: 5, ttl: 60_000 }, long: { limit: 30, ttl: 3_600_000 } };
const MAIL = { default: { limit: 3, ttl: 60_000 }, long: { limit: 10, ttl: 3_600_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle(MAIL)
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, meta(req));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, meta(req));
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT)
  google(@Body() dto: GoogleLoginDto, @Req() req: Request) {
    return this.auth.googleLogin(dto.idToken, meta(req));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, meta(req));
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT)
  verifyEmail(@Body() dto: VerifyEmailDto, @Req() req: Request) {
    return this.auth.verifyEmail(dto.token, meta(req));
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle(MAIL)
  resendVerification(@Body() dto: EmailDto) {
    return this.auth.resendVerification(dto.email);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle(MAIL)
  forgotPassword(@Body() dto: EmailDto, @Req() req: Request) {
    return this.auth.forgotPassword(dto.email, meta(req));
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT)
  resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    return this.auth.resetPassword(dto.token, dto.password, meta(req));
  }
}
