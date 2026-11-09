import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

import type { Env } from '../config/env.validation.js';

export type MailMessage = {
  to: string;
  subject: string;
  /** Yalnızca düz metin (HTML yok → içerik enjeksiyonu yok) */
  text: string;
};

// Başlık enjeksiyonuna karşı: satır sonlarını kaldır, uzunluğu sınırla
const oneLine = (value: string, max = 200) => value.replace(/[\r\n]+/g, ' ').slice(0, max);

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string | undefined;
  private readonly isDevelopment: boolean;

  constructor(config: ConfigService<Env, true>) {
    const host = config.get('SMTP_HOST', { infer: true });
    const secure = config.get('SMTP_SECURE', { infer: true }) === 'true';
    const isProduction = config.get('NODE_ENV', { infer: true }) === 'production';
    this.isDevelopment = config.get('NODE_ENV', { infer: true }) === 'development';
    this.from = config.get('SMTP_FROM', { infer: true });
    const user = config.get('SMTP_USER', { infer: true });

    this.transporter =
      host && this.from
        ? nodemailer.createTransport({
            host,
            port: config.get('SMTP_PORT', { infer: true }),
            secure,
            // Production'da şifresiz bağlantı yok (587 → STARTTLS zorunlu)
            requireTLS: !secure && isProduction,
            auth: user ? { user, pass: config.get('SMTP_PASSWORD', { infer: true }) ?? '' } : undefined,
            connectionTimeout: 10_000,
            socketTimeout: 15_000,
          })
        : null;

    if (!this.transporter) {
      this.logger.warn(
        this.isDevelopment
          ? 'SMTP tanımlı değil: e-postalar gönderilmez, GELİŞTİRME ortamında konsola yazılır.'
          : 'SMTP tanımlı değil: e-postalar gönderilmeyecek.',
      );
    }
  }

  /**
   * Arka planda gönderir: yanıt süresi e-posta gönderimine bağlı olmasın
   * (aksi halde "bu e-posta kayıtlı mı" bilgisi süreden anlaşılır) ve
   * SMTP hatası isteği bozmasın.
   */
  sendInBackground(message: MailMessage) {
    this.send(message).catch((error: unknown) =>
      this.logger.error(`E-posta gönderilemedi: ${error instanceof Error ? error.message : String(error)}`),
    );
  }

  async send(message: MailMessage) {
    if (!this.transporter || !this.from) {
      // Yalnızca geliştirmede: bağlantıyı görebilmek için konsola yaz.
      // Test/production'da token'lar ASLA loglanmaz.
      if (this.isDevelopment) {
        this.logger.log(`[DEV e-posta] Kime: ${message.to} · Konu: ${message.subject}\n${message.text}`);
      }
      return;
    }
    await this.transporter.sendMail({
      from: this.from,
      to: oneLine(message.to, 254),
      subject: oneLine(message.subject),
      text: message.text.slice(0, 20_000),
    });
  }
}
