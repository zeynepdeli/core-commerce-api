import { BadRequestException, ConflictException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CategoriesService } from './categories.service.js';
import { PublicProductQueryDto } from './dto/catalog-query.dto.js';
import { CreateProductDto } from './dto/product.dto.js';
import { ProductsService } from './products.service.js';
import { retiredValue } from './soft-delete.js';

const errorsOf = async (cls: new () => object, body: object) =>
  (await validate(plainToInstance(cls, body), { whitelist: true, forbidNonWhitelisted: true })).map((e) => e.property);

const CAT = '1b4e28ba-2fa1-11d2-883f-0016d3cca427';
const validProduct = { name: 'Tulum Peyniri', slug: 'tulum-peyniri', price: 249.9, categoryId: CAT };

describe('Ürün DTO doğrulaması', () => {
  it('geçerli ürün kabul edilir', async () => {
    expect(await errorsOf(CreateProductDto, { ...validProduct, images: [{ url: '/media/1b4e28ba-2fa1-11d2-883f-0016d3cca427.jpg' }] })).toEqual([]);
  });

  it('kategori zorunlu', async () => {
    const { categoryId: _c, ...noCategory } = validProduct;
    expect(await errorsOf(CreateProductDto, noCategory)).toContain('categoryId');
  });

  it('negatif, 2 ondalıktan fazla veya metin fiyat reddedilir', async () => {
    for (const price of [-1, 10.999, '100', Number.NaN]) {
      expect(await errorsOf(CreateProductDto, { ...validProduct, price })).toContain('price');
    }
  });

  it('javascript:/http görsel ve satır sonlu ad reddedilir', async () => {
    expect(await errorsOf(CreateProductDto, { ...validProduct, images: [{ url: 'javascript:alert(1)' }] })).toContain('images');
    expect(await errorsOf(CreateProductDto, { ...validProduct, images: [{ url: 'http://x.com/a.jpg' }] })).toContain('images');
    expect(await errorsOf(CreateProductDto, { ...validProduct, name: 'Ad\r\nBcc: x' })).toContain('name');
  });

  it('bilinmeyen alan (currency, id, iç içe productId) reddedilir — mass assignment', async () => {
    expect(await errorsOf(CreateProductDto, { ...validProduct, currency: 'USD' })).toContain('currency');
    expect(await errorsOf(CreateProductDto, { ...validProduct, id: 'x' })).toContain('id');
    expect(await errorsOf(CreateProductDto, { ...validProduct, tabs: [{ title: 'A', body: 'B', productId: 'x' }] })).toContain('tabs');
  });

  it('en fazla 12 görsel; liste limiti 48; slug dışı kategori reddedilir', async () => {
    const images = Array.from({ length: 13 }, () => ({ url: 'https://cdn.example.com/a.jpg' }));
    expect(await errorsOf(CreateProductDto, { ...validProduct, images })).toContain('images');
    expect(await errorsOf(PublicProductQueryDto, { limit: '500' })).toContain('limit');
    expect(await errorsOf(PublicProductQueryDto, { category: "a' OR 1=1" })).toContain('category');
    expect(await errorsOf(PublicProductQueryDto, { limit: '24', page: '2', sort: 'price-asc' })).toEqual([]);
  });
});

describe('ProductsService', () => {
  const prisma = {
    product: { count: vi.fn(), create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    category: { findFirst: vi.fn() },
    cartItem: { deleteMany: vi.fn() },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  };
  const service = new ProductsService(prisma as never);

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.product.count.mockResolvedValue(0);
    prisma.category.findFirst.mockResolvedValue({ id: CAT });
  });

  it('eski fiyat satış fiyatından düşükse reddedilir', async () => {
    await expect(service.create({ ...validProduct, compareAtPrice: 100 })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('silinmiş/olmayan kategori reddedilir', async () => {
    prisma.category.findFirst.mockResolvedValue(null);
    await expect(service.create(validProduct)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.category.findFirst.mock.calls[0][0].where).toMatchObject({ deletedAt: null });
  });

  it('aynı slug 409 döner', async () => {
    prisma.product.create.mockRejectedValue({ code: 'P2002', meta: { target: ['slug'] } });
    await expect(service.create(validProduct)).rejects.toBeInstanceOf(ConflictException);
  });

  it('fiyat 2 basamağa sabitlenir, görseller sırayla kaydedilir', async () => {
    prisma.product.create.mockResolvedValue({ id: 'p1' });
    prisma.product.findFirst.mockResolvedValue({ id: 'p1', price: { toFixed: () => '249.90' }, compareAtPrice: null, deletedAt: null });
    await service.create({ ...validProduct, images: [{ url: 'https://a.co/1.jpg' }, { url: 'https://a.co/2.jpg', alt: ' Ön ' }] });
    const data = prisma.product.create.mock.calls[0][0].data;
    expect(data.price).toBe('249.90');
    expect(data).not.toHaveProperty('currency');
    expect(data.images.create).toEqual([
      { url: 'https://a.co/1.jpg', alt: null, order: 0 },
      { url: 'https://a.co/2.jpg', alt: 'Ön', order: 1 },
    ]);
  });

  it('ziyaretçi listesi: yayında + silinmemiş + kategorisi görünür; stok adedi gizli', async () => {
    prisma.product.count.mockResolvedValue(1);
    prisma.product.findMany.mockResolvedValue([
      { id: 'p1', name: 'A', slug: 'a', summary: null, price: { toFixed: () => '10.00' }, compareAtPrice: null, currency: 'TRY', unit: null, featured: false, trackStock: true, stock: 0, images: [], category: null },
    ]);
    const result = await service.findPublic({});
    const where = JSON.stringify(prisma.product.findMany.mock.calls[0][0].where);
    expect(where).toContain('"isActive":true');
    expect(where).toContain('"deletedAt":null');
    expect(where).toContain('"category":{"isActive":true,"deletedAt":null}');
    expect(result.items[0]).toMatchObject({ inStock: false, price: '10.00' });
    expect(result.items[0]).not.toHaveProperty('stock');
  });

  it('silme soft delete: kayıt kalır, slug/sku serbest kalır, sepetlerden çıkar', async () => {
    prisma.product.findFirst.mockResolvedValue({ id: 'abcdef12-0000', slug: 'tulum', sku: 'TLM-1' });
    await service.remove('abcdef12-0000');
    const data = prisma.product.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ isActive: false, slug: 'tulum--silindi-abcdef12', sku: 'TLM-1--silindi-abcdef12' });
    expect(data.deletedAt).toBeInstanceOf(Date);
    expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({ where: { productId: 'abcdef12-0000' } });
  });
});

describe('CategoriesService', () => {
  const prisma = { category: { findFirst: vi.fn(), update: vi.fn() } };
  const service = new CategoriesService(prisma as never);

  it('içinde ürün olan kategori silinmez', async () => {
    prisma.category.findFirst.mockResolvedValue({ id: 'c1', name: 'A', slug: 'a', _count: { products: 3 } });
    await expect(service.remove('c1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.category.update).not.toHaveBeenCalled();
  });

  it('boş kategori soft delete ile silinir, ad/adres serbest kalır', async () => {
    prisma.category.findFirst.mockResolvedValue({ id: 'c1234567-x', name: 'Peynir', slug: 'peynir', _count: { products: 0 } });
    await service.remove('c1234567-x');
    expect(prisma.category.update.mock.calls[0][0].data).toMatchObject({ name: 'Peynir--silindi-c1234567', slug: 'peynir--silindi-c1234567', isActive: false });
  });

  it('retiredValue uzun değeri kısaltır', () => {
    expect(retiredValue('a'.repeat(200), '12345678-abcd').length).toBeLessThanOrEqual(140);
  });
});
