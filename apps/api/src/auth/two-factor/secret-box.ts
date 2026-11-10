import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

/**
 * TOTP anahtarını veritabanında şifreli tutar (AES-256-GCM). Veritabanı yedeği
 * sızsa bile anahtarlar kullanılamaz. Kullanıcı kimliği "ek doğrulanmış veri"
 * olarak bağlanır: şifreli değer başka kullanıcının satırına kopyalanırsa çözülmez.
 */
export class SecretBox {
  private readonly key: Buffer;

  /** key: 32 bayt. Yoksa (yalnızca geliştirme) JWT anahtarından türetilir. */
  constructor(key: Buffer | undefined, fallbackSeed: string) {
    this.key = key ?? Buffer.from(hkdfSync('sha256', fallbackSeed, 'core-commerce', 'two-factor-secret-v1', 32));
  }

  seal(plain: string, userId: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(userId));
    const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ct.toString('base64url')].join('.');
  }

  open(sealed: string, userId: string): string | null {
    const [v, iv, tag, ct] = sealed.split('.');
    if (v !== 'v1' || !iv || !tag || !ct) return null;
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
      decipher.setAAD(Buffer.from(userId));
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString('utf8');
    } catch {
      return null;
    }
  }
}
