import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import type { EnvConfig } from '../config/env.validation';

// Sistemde önceden üretilmiş, gerçek bir kullanıcıya AİT OLMAYAN dummy hash.
// Sadece CPU/bellek tüketim profilini gerçek argon2.verify çağrısıyla eşitlemek için var.
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$8Kz3q1t5nF2gW9hLxYpVzR3eN6oJ4uMk';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Bu email adresi zaten kayıtlı.');
    }

    const passwordHash = await this.hashPassword(dto.password);

    try {
      return await this.prisma.user.create({
        data: {
          email: dto.email,
          name: dto.name,
          passwordHash,
          signupMethod: 'LOCAL',
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Bu email adresi zaten kayıtlı.');
      }
      throw new InternalServerErrorException('Kullanıcı oluşturulamadı.');
    }
  }

  async login(dto: LoginDto, meta: { ipAddress?: string; userAgent?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Adım A: kullanıcı bulunamadı
    if (!user) {
      await this.simulateHashDelay();
      await this.recordLoginAttempt(dto.email, meta, false);
      throw new UnauthorizedException('Email veya şifre hatalı.');
    }

    // Adım B: hesap kilitli — simulateHashDelay burada da çağrılıyor,
    // aksi halde kilitli/kilitli-olmayan hesaplar arasındaki yanıt süresi
    // farkı, saldırgana "bu email var ve şu an kilitli" bilgisini sızdırırdı.
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.simulateHashDelay();
      await this.recordLoginAttempt(dto.email, meta, false);
      throw new UnauthorizedException('Email veya şifre hatalı.');
    }

    // Adım C: Google-only kullanıcı (local şifresi yok)
    if (!user.passwordHash) {
      await this.simulateHashDelay();
      await this.recordLoginAttempt(dto.email, meta, false);
      throw new UnauthorizedException('Email veya şifre hatalı.');
    }

    // Adım D: gerçek şifre doğrulama
    const isValid = await argon2.verify(user.passwordHash, dto.password);

    if (!isValid) {
      await this.handleFailedLogin(user.id, user.failedLoginCount);
      await this.recordLoginAttempt(dto.email, meta, false);
      throw new UnauthorizedException('Email veya şifre hatalı.');
    }

    // Adım E: başarılı giriş
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
    await this.recordLoginAttempt(dto.email, meta, true);

    // TODO: sıradaki adımda issueTokens() ile JWT üretimini ekleyeceğiz
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }

  private async simulateHashDelay(): Promise<void> {
    try {
      await argon2.verify(DUMMY_HASH, 'dummy_password_for_timing_safety');
    } catch {
      // Hata beklenen davranış (hash zaten uyuşmuyor) — amaç sadece
      // gerçek bir argon2.verify ile aynı CPU/bellek/zaman profilini
      // taklit etmek, sonucu umursamıyoruz.
    }
  }

  private async handleFailedLogin(
    userId: string,
    currentCount: number,
  ): Promise<void> {
    const maxAttempts = this.config.get('MAX_FAILED_LOGIN_ATTEMPTS', {
      infer: true,
    });
    const lockoutMinutes = this.config.get('LOCKOUT_DURATION_MINUTES', {
      infer: true,
    });

    const newCount = currentCount + 1;
    const shouldLock = newCount >= maxAttempts;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: newCount,
        lockedUntil: shouldLock
          ? new Date(Date.now() + lockoutMinutes * 60 * 1000)
          : undefined,
      },
    });
  }

  private async recordLoginAttempt(
    email: string,
    meta: { ipAddress?: string; userAgent?: string },
    success: boolean,
  ): Promise<void> {
    await this.prisma.loginAttempt.create({
      data: {
        email,
        ipAddress: meta.ipAddress ?? 'unknown',
        success,
      },
    });
  }

  private async hashPassword(plain: string): Promise<string> {
    return argon2.hash(plain, {
      type: argon2.argon2id,
      memoryCost: this.config.get('ARGON2_MEMORY_COST', { infer: true }),
      timeCost: this.config.get('ARGON2_TIME_COST', { infer: true }),
      parallelism: this.config.get('ARGON2_PARALLELISM', { infer: true }),
    });
  }
}
