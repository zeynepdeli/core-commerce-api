import { describe, expect, it } from 'vitest';

import { SecretBox } from './secret-box.js';
import { base32Decode, base32Encode, hotp, newTotpSecret, otpauthUrl, verifyTotp } from './totp.js';

// RFC 6238 Ek B test anahtarı (SHA1): "12345678901234567890"
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('TOTP (RFC 6238)', () => {
  it('base32 gidiş-dönüş', () => {
    const buf = Buffer.from('merhaba dünya');
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
    expect(RFC_SECRET).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  });

  it('RFC test vektörleri (8 hane)', () => {
    const key = Buffer.from('12345678901234567890');
    expect(hotp(key, Math.floor(59 / 30), 8)).toBe('94287082');
    expect(hotp(key, Math.floor(1111111109 / 30), 8)).toBe('07081804');
    expect(hotp(key, Math.floor(1234567890 / 30), 8)).toBe('89005924');
    expect(hotp(key, Math.floor(20000000000 / 30), 8)).toBe('65353130');
  });

  it('6 haneli kod doğrulanır, ±30 sn kayma kabul, daha fazlası değil', () => {
    const t = 1234567890 * 1000;
    expect(verifyTotp(RFC_SECRET, '005924', t)).toBe(Math.floor(1234567890 / 30));
    expect(verifyTotp(RFC_SECRET, '005924', t + 30_000)).not.toBeNull();
    expect(verifyTotp(RFC_SECRET, '005924', t + 90_000)).toBeNull();
    expect(verifyTotp(RFC_SECRET, '000000', t)).toBeNull();
    expect(verifyTotp(RFC_SECRET, '12345', t)).toBeNull();
    expect(verifyTotp(RFC_SECRET, 'abcdef', t)).toBeNull();
  });

  it('yeni anahtar 160 bit, otpauth adresi', () => {
    const s = newTotpSecret();
    expect(base32Decode(s).length).toBe(20);
    expect(otpauthUrl(s, 'admin@x.com', 'admin.x.com')).toMatch(/^otpauth:\/\/totp\/admin\.x\.com%3Aadmin%40x\.com\?secret=[A-Z2-7]+&issuer=admin\.x\.com/);
  });
});

describe('SecretBox (AES-256-GCM)', () => {
  const box = new SecretBox(Buffer.alloc(32, 7), 'unused');
  it('şifreler ve çözer; düz metin görünmez', () => {
    const sealed = box.seal('GEZDGNBV', 'user-1');
    expect(sealed).not.toContain('GEZDGNBV');
    expect(box.open(sealed, 'user-1')).toBe('GEZDGNBV');
  });
  it('başka kullanıcıya kopyalanmış değer çözülmez', () => {
    expect(box.open(box.seal('X', 'user-1'), 'user-2')).toBeNull();
  });
  it('kurcalanmış değer ve yanlış anahtar reddedilir', () => {
    const sealed = box.seal('X', 'u');
    const parts = sealed.split('.');
    parts[3] = Buffer.from('Y').toString('base64url');
    expect(box.open(parts.join('.'), 'u')).toBeNull();
    expect(new SecretBox(Buffer.alloc(32, 8), '').open(sealed, 'u')).toBeNull();
    expect(box.open('bozuk', 'u')).toBeNull();
  });
});
