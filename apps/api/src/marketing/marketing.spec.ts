import { describe, expect, it } from 'vitest';

import { ConsentsService } from './consents.service.js';
import { xml } from './product-feed.service.js';

describe('xml()', () => {
  it('özel karakterleri kaçışlar, kontrol karakterlerini atar', () => {
    expect(xml(`A & B <c> "d" 'e'`)).toBe('A &amp; B &lt;c&gt; &quot;d&quot; &apos;e&apos;');
    expect(xml('a\u0000b\u0007c')).toBe('abc');
    expect(xml('x'.repeat(10), 3)).toBe('xxx');
  });
});

describe('ret bağlantısı', () => {
  const svc = new ConsentsService({} as never, { get: () => 'k'.repeat(64) } as never);
  it('imzalı, değiştirilemez', async () => {
    const t = svc.unsubscribeToken('Ayse@Test.com');
    expect(t).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(t.split('.')[0], 'base64url').toString()).toBe('ayse@test.com');
    const other = `${Buffer.from('baska@test.com').toString('base64url')}.${t.split('.')[1]}`;
    await expect(svc.unsubscribe(other)).rejects.toThrow('geçersiz');
    await expect(svc.unsubscribe('bozuk')).rejects.toThrow('geçersiz');
  });
});
