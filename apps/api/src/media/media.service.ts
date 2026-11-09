import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service.js';

import { MediaFileValidatorService } from './media-file-validator.service.js';
import { MEDIA_STORAGE, type MediaStorage } from './storage/media-storage.js';

const PAGE_SIZE = 60;

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileValidator: MediaFileValidatorService,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
  ) {}

  /** Sayfalı liste; her görsel için "kullanımda mı" bilgisi (yalnızca o sayfadaki adresler sorgulanır) */
  async findPage(page = 1) {
    const [total, items] = await this.prisma.$transaction([
      this.prisma.media.count(),
      this.prisma.media.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ]);
    const used = await this.usedAmong(items.map((item) => item.url));
    return {
      items: items.map((item) => ({ ...item, inUse: used.has(item.url) })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    };
  }

  /**
   * Verilen adreslerden hangileri bir yerde kullanılıyor?
   * Yeni bir görsel alanı eklendiğinde BURAYA da eklenmeli; aksi halde
   * kullanımdaki bir görsel silinebilir.
   */
  async usedAmong(urls: string[]): Promise<Set<string>> {
    if (urls.length === 0) return new Set();
    const [productImages, categories, themes] = await Promise.all([
      this.prisma.productImage.findMany({ where: { url: { in: urls } }, select: { url: true }, distinct: ['url'] }),
      this.prisma.category.findMany({ where: { image: { in: urls }, deletedAt: null }, select: { image: true } }),
      this.prisma.siteTheme.findMany({ select: { backgroundImageUrl: true, cardTextureUrl: true, logoUrl: true, faviconUrl: true } }),
    ]);
    const wanted = new Set(urls);
    const used = [
      ...productImages.map((i) => i.url),
      ...categories.map((c) => c.image),
      ...themes.flatMap((t) => [t.backgroundImageUrl, t.cardTextureUrl, t.logoUrl, t.faviconUrl]),
    ].filter((url): url is string => !!url && wanted.has(url));
    return new Set(used);
  }

  async upload(input: { originalName: string; buffer: Buffer }) {
    const validated = await this.fileValidator.validate(input.buffer);
    const { storageKey, url } = await this.storage.save({
      id: randomUUID(),
      extension: validated.extension,
      buffer: validated.buffer,
      mimeType: validated.mimeType,
    });

    try {
      return await this.prisma.media.create({
        data: {
          // Dosya adı yalnızca gösterim için; kontrol karakterleri temizlenir
          originalName: input.originalName.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 255) || 'görsel',
          storageKey,
          mimeType: validated.mimeType,
          size: validated.size,
          width: validated.width,
          height: validated.height,
          url,
        },
      });
    } catch (error) {
      // Kayıt oluşmadıysa yüklenen dosyayı geri al
      await this.storage.remove(storageKey).catch(() => this.logger.error(`Yükleme geri alınamadı: ${storageKey}`));
      throw error;
    }
  }

  async updateAlt(id: string, alt: string | null) {
    const media = await this.prisma.media.findUnique({ where: { id }, select: { id: true } });
    if (!media) throw new NotFoundException('Görsel bulunamadı.');
    return this.prisma.media.update({ where: { id }, data: { alt: alt?.trim() || null } });
  }

  async remove(id: string) {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media) throw new NotFoundException('Görsel bulunamadı.');

    // Kullanımdaki görsel silinirse mağazada kırık görsel oluşur
    if ((await this.usedAmong([media.url])).size > 0) {
      throw new ConflictException('Bu görsel kullanılıyor (ürün, kategori veya tema). Önce kullanıldığı yerden kaldırın.');
    }

    // Önce kayıt: dosya silinemezse kırık kayıt kalmaz, yalnızca sahipsiz dosya kalır (loglanır)
    await this.prisma.media.delete({ where: { id } });
    try {
      await this.storage.remove(media.storageKey);
    } catch {
      this.logger.error(`Görsel kaydı silindi ama dosya silinemedi: ${media.storageKey}`);
    }
    return { success: true };
  }
}
