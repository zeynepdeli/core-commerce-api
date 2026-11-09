import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'node:crypto';

import type { Env } from '../config/env.validation.js';

export type IyzicoResponse = {
  status: 'success' | 'failure';
  errorCode?: string;
  errorMessage?: string;
  signature?: string;
  [key: string]: unknown;
};

/**
 * iyzico REST istemcisi (SDK yok; yalnızca HTTPS + HMAC).
 * Kimlik doğrulama IYZWSv2: HMAC-SHA256(secret, randomKey + uriPath + gövde).
 * Gizli anahtar asla isteğe veya loga yazılmaz.
 */
@Injectable()
export class IyzicoClient {
  private readonly logger = new Logger(IyzicoClient.name);
  private readonly apiKey?: string;
  private readonly secretKey?: string;
  private readonly baseUrl: string;

  /** Testlerde sahte sunucuya yönlendirmek için değiştirilebilir */
  fetchImpl: typeof fetch = fetch;

  constructor(config: ConfigService<Env, true>) {
    this.apiKey = config.get('IYZICO_API_KEY', { infer: true });
    this.secretKey = config.get('IYZICO_SECRET_KEY', { infer: true });
    this.baseUrl = config.get('IYZICO_BASE_URL', { infer: true }).replace(/\/$/, '');
  }

  get enabled() {
    return !!this.apiKey && !!this.secretKey;
  }

  authorization(uriPath: string, body: string, randomKey = `${Date.now()}${randomBytes(8).toString('hex')}`) {
    const signature = createHmac('sha256', this.secretKey as string)
      .update(randomKey + uriPath + body)
      .digest('hex');
    const auth = `apiKey:${this.apiKey}&randomKey:${randomKey}&signature:${signature}`;
    return { authorization: `IYZWSv2 ${Buffer.from(auth).toString('base64')}`, randomKey };
  }

  /**
   * Yanıt imzası: iyzico, belirli alanları ":" ile birleştirip HMAC-SHA256(secret) ile imzalar.
   * Sağlayıcı ondalıkları "10.0"/"10.50" biçiminde dönebildiği için hem ham hem
   * sondaki sıfırları atılmış biçim denenir. Karşılaştırma sabit sürelidir.
   */
  verifySignature(fields: unknown[], signature: unknown): boolean {
    if (typeof signature !== 'string' || !/^[0-9a-f]{64}$/i.test(signature)) return false;
    const variants = [fields.map(String), fields.map((f) => (typeof f === 'number' || /^\d+\.\d+$/.test(String(f)) ? stripZeros(String(f)) : String(f)))];
    return variants.some((parts) => {
      const expected = createHmac('sha256', this.secretKey as string).update(parts.join(':')).digest('hex');
      return safeEqualHex(expected, signature.toLowerCase());
    });
  }

  async post(uriPath: string, payload: object): Promise<IyzicoResponse> {
    if (!this.enabled) throw new ServiceUnavailableException('Online ödeme bu mağazada yapılandırılmamış.');
    const body = JSON.stringify(payload);
    const { authorization, randomKey } = this.authorization(uriPath, body);
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${uriPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: authorization, 'x-iyzi-rnd': randomKey },
        body,
        redirect: 'error',
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      this.logger.error(`iyzico'ya ulaşılamadı (${uriPath}): ${(error as Error).name}`);
      throw new ServiceUnavailableException('Ödeme sağlayıcısına ulaşılamadı. Lütfen tekrar deneyin.');
    }
    const data = (await response.json().catch(() => ({ status: 'failure', errorMessage: 'Geçersiz yanıt' }))) as IyzicoResponse;
    if (data.status !== 'success') {
      this.logger.warn(`iyzico hata (${uriPath}): ${String(data.errorCode ?? response.status)} ${String(data.errorMessage ?? '').slice(0, 200)}`);
    }
    return data;
  }
}

/** "10.50" → "10.5", "10.0" → "10" */
export function stripZeros(value: string): string {
  return value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value;
}

function safeEqualHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
