import { createHash } from 'node:crypto';

import type { MediaStorage } from './media-storage.js';

export type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
};

/**
 * Cloudinary imzası: parametreler alfabetik sıralanıp "a=1&b=2" yapılır,
 * sonuna API secret eklenip SHA-256 alınır. Secret asla istekte gönderilmez.
 */
export function signCloudinary(params: Record<string, string | number>, apiSecret: string) {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return createHash('sha256').update(toSign + apiSecret).digest('hex');
}

const SECURE_URL = /^https:\/\/res\.cloudinary\.com\/[a-z0-9_-]+\/image\/upload\/[A-Za-z0-9_./-]+$/i;

/** Cloudinary: imzalı yükleme (SDK yok, yalnızca HTTPS isteği) */
export class CloudinaryMediaStorage implements MediaStorage {
  readonly kind = 'cloudinary' as const;

  constructor(
    private readonly config: CloudinaryConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private endpoint(action: 'upload' | 'destroy') {
    return `https://api.cloudinary.com/v1_1/${this.config.cloudName}/image/${action}`;
  }

  async save({ id, buffer, mimeType }: { id: string; extension: string; buffer: Buffer; mimeType: string }) {
    const timestamp = Math.floor(Date.now() / 1000);
    const params = { folder: this.config.folder, overwrite: 'false', public_id: id, timestamp };

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }));
    for (const [k, v] of Object.entries(params)) form.append(k, String(v));
    form.append('api_key', this.config.apiKey);
    form.append('signature_algorithm', 'sha256');
    form.append('signature', signCloudinary(params, this.config.apiSecret));

    const response = await this.fetchImpl(this.endpoint('upload'), {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    const data = (await response.json().catch(() => ({}))) as { public_id?: unknown; secure_url?: unknown };

    if (!response.ok || typeof data.public_id !== 'string' || typeof data.secure_url !== 'string') {
      throw new Error(`Cloudinary yüklemesi başarısız (HTTP ${response.status}).`);
    }
    // Dönen adres beklenen kalıpta değilse kaydetme
    if (!SECURE_URL.test(data.secure_url)) {
      throw new Error('Cloudinary beklenmeyen bir adres döndürdü.');
    }
    return { storageKey: data.public_id, url: data.secure_url };
  }

  async remove(storageKey: string) {
    const timestamp = Math.floor(Date.now() / 1000);
    const params = { invalidate: 'true', public_id: storageKey, timestamp };
    const form = new FormData();
    for (const [k, v] of Object.entries(params)) form.append(k, String(v));
    form.append('api_key', this.config.apiKey);
    form.append('signature_algorithm', 'sha256');
    form.append('signature', signCloudinary(params, this.config.apiSecret));

    const response = await this.fetchImpl(this.endpoint('destroy'), {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await response.json().catch(() => ({}))) as { result?: unknown };
    // "not found" da başarılı sayılır (zaten yok)
    if (!response.ok || (data.result !== 'ok' && data.result !== 'not found')) {
      throw new Error(`Cloudinary silmesi başarısız (HTTP ${response.status}).`);
    }
  }
}
