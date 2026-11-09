import { INTERNAL_PATH_REGEX, isImageUrl } from './validators.js';

describe('INTERNAL_PATH_REGEX (açık yönlendirme koruması)', () => {
  it.each(['/', '/hakkimizda', '/urunler?kategori=1', '/iletisim#form'])(
    'site içi yolu kabul eder: %s',
    (value) => {
      expect(INTERNAL_PATH_REGEX.test(value)).toBe(true);
    },
  );

  it.each([
    '//evil.com',
    '/\\evil.com',
    '/a\\b',
    'https://evil.com',
    'javascript:alert(1)',
    '/ boşluk',
    '/tab\there',
    '/null\u0000byte',
    '',
  ])('tehlikeli değeri reddeder: %j', (value) => {
    expect(INTERNAL_PATH_REGEX.test(value)).toBe(false);
  });
});

describe('isImageUrl', () => {
  it.each([
    '/media/0b8f1a52-3c4d-4e5f-8a9b-0c1d2e3f4a5b.webp',
    'https://cdn.example.com/bg.jpg',
  ])('geçerli görsel adresini kabul eder: %s', (value) => {
    expect(isImageUrl(value)).toBe(true);
  });

  it.each([
    'http://example.com/a.jpg',
    'javascript:alert(1)',
    'data:image/svg+xml;base64,PHN2Zz4=',
    'https://user:pass@example.com/a.jpg',
    '/media/../../etc/passwd',
    '/media/abc.svg',
    'https://localhost/a.jpg',
    42,
  ])('geçersiz değeri reddeder: %j', (value) => {
    expect(isImageUrl(value)).toBe(false);
  });
});

describe('uniqueViolationFields', () => {
  it('Prisma 7 driver adapter biçimi ve eski target biçimi', async () => {
    const { uniqueViolationFields } = await import('./validators.js');
    expect(
      uniqueViolationFields({
        meta: { modelName: 'Category', driverAdapterError: { name: 'DriverAdapterError', cause: { constraint: { index: 'Category_slug_key' } } } },
      }),
    ).toEqual(['slug']);
    expect(uniqueViolationFields({ meta: { target: ['sku'] } })).toEqual(['sku']);
    expect(uniqueViolationFields({})).toEqual([]);
  });
});
