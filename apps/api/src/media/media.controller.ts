import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Req,
  Res,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { join } from 'node:path';

const KEY =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|mp4|webm)$/;
const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp4: 'video/mp4',
  webm: 'video/webm',
};

/**
 * "Range: bytes=…" başlığını çözer (tek aralık). Tarayıcılar (özellikle Safari) videoyu parça parça ister;
 * yanıt 206 olmazsa video oynamaz ya da ileri sarılamaz.
 * - null: başlık yok, biçimi tanınmıyor ya da çok aralıklı → tüm dosya (200), RFC 9110'a uygun
 * - "unsatisfiable": aralık dosyanın dışında → 416
 */
export function parseRange(
  header: string | undefined,
  size: number,
): { start: number; end: number } | 'unsatisfiable' | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === '' && match[2] === '')) return null;
  if (size === 0) return 'unsatisfiable';

  let start: number;
  let end: number;
  if (match[1] === '') {
    // Son N bayt
    const suffix = Number(match[2]);
    if (suffix === 0) return 'unsatisfiable';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start > end ||
    start >= size
  )
    return 'unsatisfiable';
  return { start, end };
}

/**
 * Yerel depolamadaki görselleri ve videoları sunar (MEDIA_STORAGE=local).
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
  async serve(
    @Param('storageKey') storageKey: string,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const match = KEY.exec(storageKey);
    if (!match) throw new NotFoundException('Dosya bulunamadı.');

    let handle;
    let size: number;
    try {
      handle = await open(
        join(this.directory, storageKey),
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
      const stats = await handle.stat();
      if (!stats.isFile()) throw new Error('not a file');
      size = stats.size;
    } catch {
      await handle?.close().catch(() => undefined);
      throw new NotFoundException('Dosya bulunamadı.');
    }

    response.setHeader('Content-Type', MIME[match[1]]);
    response.setHeader('Content-Disposition', 'inline');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    response.setHeader('Accept-Ranges', 'bytes');

    const range = parseRange(request.headers.range, size);
    if (range === 'unsatisfiable') {
      await handle.close().catch(() => undefined);
      response.status(416).setHeader('Content-Range', `bytes */${size}`);
      response.end();
      return;
    }

    if (range) {
      response.status(206);
      response.setHeader(
        'Content-Range',
        `bytes ${range.start}-${range.end}/${size}`,
      );
      response.setHeader('Content-Length', String(range.end - range.start + 1));
    } else {
      response.setHeader('Content-Length', String(size));
    }

    const stream = handle.createReadStream({
      autoClose: true,
      ...(range ?? {}),
    });
    stream.on('error', () => response.destroy());
    stream.pipe(response);
  }
}
