import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';

import type { Env } from '../config/env.validation.js';

@Injectable()
export class PasswordService implements OnModuleInit {
  private dummyHash = '';

  constructor(private readonly config: ConfigService<Env, true>) {}

  /**
   * Gerçek bir kullanıcıya AİT OLMAYAN sahte hash, açılışta GÜNCEL argon2
   * ayarlarıyla üretilir. Böylece ARGON2_MEMORY_COST yükseltilse bile sahte
   * doğrulama gerçek doğrulamayla aynı sürede biter ve "bu e-posta kayıtlı mı"
   * bilgisi yanıt süresinden anlaşılamaz.
   */
  async onModuleInit() {
    this.dummyHash = await this.hash(randomBytes(32).toString('base64url'));
  }

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, {
      type: argon2.argon2id,
      memoryCost: this.config.get('ARGON2_MEMORY_COST', { infer: true }),
      timeCost: this.config.get('ARGON2_TIME_COST', { infer: true }),
      parallelism: this.config.get('ARGON2_PARALLELISM', { infer: true }),
    });
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  /** Kullanıcı yok / kilitli / şifresiz durumlarda süreyi eşitlemek için */
  async simulateVerify(): Promise<void> {
    await this.verify(this.dummyHash, 'dummy_password_for_timing_safety');
  }
}
