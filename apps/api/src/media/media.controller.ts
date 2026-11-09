import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { join } from 'node:path';

const KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;
const MIME: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/**
 * Yerel depolamadaki görselleri sunar (MEDIA_STORAGE=local).
 * Dosya adı rastgele UUID olduğu ve içerik asla değişmediği için
 * tarayıcı/CDN 1 yıl önbelleğe alabilir (immutable) → hızlı sayfa.
 * Yol geçişine (../) karşı yalnızca kendi ürettiğimiz biçim kabul edilir;
 * sembolik bağlantı izlenmez.
 */
@Controller('media')
@SkipThrottle()
export class MediaController {
  private readonly directory = join(process.cwd(), 'storage', 'media');

  @Get(':storageKey')
  async serve(@Param('storageKey') storageKey: string, @Res() response: Response) {
    const match = KEY.exec(storageKey);
    if (!match) throw new NotFoundException('Görsel bulunamadı.');

    let handle;
    try {
      handle = await open(join(this.directory, storageKey), constants.O_RDONLY | constants.O_NOFOLLOW);
      const stats = await handle.stat();
      if (!stats.isFile()) throw new Error('not a file');
      response.setHeader('Content-Length', String(stats.size));
    } catch {
      await handle?.close().catch(() => undefined);
      throw new NotFoundException('Görsel bulunamadı.');
    }

    response.setHeader('Content-Type', MIME[match[1]]);
    response.setHeader('Content-Disposition', 'inline');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    const stream = handle.createReadStream({ autoClose: true });
    stream.on('error', () => response.destroy());
    stream.pipe(response);
  }
}
