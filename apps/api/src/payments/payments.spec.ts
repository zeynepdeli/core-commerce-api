import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { buildBasket, netLineTotals, splitName } from './basket.js';
import { IyzicoClient, stripZeros } from '../iyzico/iyzico.client.js';

const config = (env: Record<string, string | undefined>) => ({ get: (k: string) => env[k] }) as never;
const client = new IyzicoClient(config({ IYZICO_API_KEY: 'sandbox-apikey123', IYZICO_SECRET_KEY: 'sandbox-secret123', IYZICO_BASE_URL: 'https://sandbox-api.iyzipay.com' }));
const sum = (items: { price: string }[]) => items.reduce((s, i) => s + Math.round(Number(i.price) * 100), 0);

describe('buildBasket', () => {
  it('indirimi oranında dağıtır, toplam kuruşu kuruşuna eşit olur', () => {
    const lines = [
      { id: 'a', name: 'Bal', category: 'Gıda', lineTotal: 33_333 },
      { id: 'b', name: 'Peynir', category: 'Gıda', lineTotal: 16_667 },
      { id: 'c', name: 'Zeytin', category: 'Gıda', lineTotal: 10_001 },
    ];
    const items = buildBasket(lines, 50_000 + 4_990, 4_990); // 10 001 kuruş indirim + kargo
    expect(sum(items)).toBe(54_990);
    expect(items.at(-1)).toMatchObject({ id: 'KARGO', itemType: 'VIRTUAL', price: '49.90' });
  });

  it('kargo yoksa ve indirim yoksa satırları aynen gönderir', () => {
    const items = buildBasket([{ id: 'a', name: 'Bal', category: 'Gıda', lineTotal: 24_990 }], 24_990, 0);
    expect(items).toEqual([{ id: 'a', name: 'Bal', category1: 'Gıda', itemType: 'PHYSICAL', price: '249.90' }]);
  });

  it('0 ₺ kalan satırı atlar (iyzico 0 tutarlı kalemi kabul etmez)', () => {
    const items = buildBasket(
      [
        { id: 'a', name: 'A', category: 'X', lineTotal: 100 },
        { id: 'b', name: 'B', category: 'X', lineTotal: 1 },
      ],
      100,
      0,
    );
    expect(sum(items)).toBe(100);
    expect(items.every((i) => i.price !== '0.00')).toBe(true);
  });

  it('toplam satırlardan büyükse hata verir (fiyat manipülasyonu / tutarsızlık)', () => {
    expect(() => buildBasket([{ id: 'a', name: 'A', category: 'X', lineTotal: 100 }], 500, 0)).toThrow();
  });
});

describe('netLineTotals (iade tutarı = ödeme kalemi)', () => {
  it('indirimi satırlara dağıtır, toplam korunur', () => {
    const net = netLineTotals([{ lineTotal: 30_000 }, { lineTotal: 5_000 }], 31_500 + 4_990, 4_990);
    expect(net).toEqual([27_000, 4_500]);
  });
  it('sepet ile aynı sonucu verir', () => {
    const lines = [
      { id: 'a', name: 'A', category: 'X', lineTotal: 9_999 },
      { id: 'b', name: 'B', category: 'X', lineTotal: 333 },
    ];
    const net = netLineTotals(lines, 9_000, 0);
    expect(buildBasket(lines, 9_000, 0).map((i) => Math.round(Number(i.price) * 100))).toEqual(net);
  });
});

describe('splitName', () => {
  it('son kelimeyi soyad yapar', () => {
    expect(splitName('Ayşe Nur Yılmaz')).toEqual({ name: 'Ayşe Nur', surname: 'Yılmaz' });
    expect(splitName('  Cem ')).toEqual({ name: 'Cem', surname: 'Cem' });
  });
});

describe('IyzicoClient', () => {
  it('IYZWSv2 başlığını doğru üretir', () => {
    const body = '{"locale":"tr"}';
    const { authorization } = client.authorization('/payment/test', body, 'rnd123');
    const decoded = Buffer.from(authorization.replace('IYZWSv2 ', ''), 'base64').toString();
    const signature = createHmac('sha256', 'sandbox-secret123').update('rnd123/payment/test' + body).digest('hex');
    expect(decoded).toBe(`apiKey:sandbox-apikey123&randomKey:rnd123&signature:${signature}`);
  });

  it('yanıt imzasını doğrular; sondaki sıfırlar farklı olsa da eşleşir', () => {
    const sig = createHmac('sha256', 'sandbox-secret123').update('SUCCESS:123:TRY:b:c:10.5:10.5:tok').digest('hex');
    expect(client.verifySignature(['SUCCESS', '123', 'TRY', 'b', 'c', '10.50', '10.50', 'tok'], sig)).toBe(true);
    expect(client.verifySignature(['SUCCESS', '123', 'TRY', 'b', 'c', 10.5, 10.5, 'tok'], sig)).toBe(true);
  });

  it('kurcalanmış yanıtı reddeder', () => {
    const sig = createHmac('sha256', 'sandbox-secret123').update('SUCCESS:123:TRY:b:c:10.5:10.5:tok').digest('hex');
    expect(client.verifySignature(['SUCCESS', '123', 'TRY', 'b', 'c', '1.5', '1.5', 'tok'], sig)).toBe(false);
    expect(client.verifySignature(['SUCCESS'], undefined)).toBe(false);
    expect(client.verifySignature(['SUCCESS'], 'abc')).toBe(false);
  });

  it('stripZeros', () => {
    expect(stripZeros('10.50')).toBe('10.5');
    expect(stripZeros('10.00')).toBe('10');
    expect(stripZeros('100')).toBe('100');
  });

  it('anahtar yoksa kapalıdır ve 503 döner', async () => {
    const off = new IyzicoClient(config({ IYZICO_BASE_URL: 'https://sandbox-api.iyzipay.com' }));
    expect(off.enabled).toBe(false);
    await expect(off.post('/x', {})).rejects.toThrow('yapılandırılmamış');
  });
});
