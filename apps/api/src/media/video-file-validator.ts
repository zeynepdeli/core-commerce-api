import { BadRequestException } from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';

export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

export type ValidatedVideoFile = {
  mimeType: 'video/mp4' | 'video/webm';
  extension: 'mp4' | 'webm';
  size: number;
  buffer: Buffer;
};

/**
 * MP4'ün üst düzey kutularını (box) baştan sona dolaşır. Her kutunun boyutu dosyanın içinde kalmalı,
 * türü 4 yazdırılabilir karakter olmalı, ilk kutu "ftyp" olmalı ve "moov" (bilgi) ile "mdat" (görüntü)
 * bulunmalı. Kutuların dışında kalan bayt, tutarsız boyut ya da eksik kutu → geçersiz.
 * Böylece başına MP4 imzası eklenmiş başka bir dosya (polyglot) video diye kabul edilmez.
 */
export function isWellFormedMp4(buffer: Buffer): boolean {
  let offset = 0;
  let index = 0;
  const seen = new Set<string>();
  while (offset < buffer.length) {
    if (buffer.length - offset < 8) return false;
    let size = buffer.readUInt32BE(offset);
    const type = buffer.toString('latin1', offset + 4, offset + 8);
    if (!/^[\x20-\x7e]{4}$/.test(type)) return false;
    if (index === 0 && type !== 'ftyp') return false;
    let header = 8;
    if (size === 1) {
      // 64 bit boyut
      if (buffer.length - offset < 16) return false;
      const big = buffer.readBigUInt64BE(offset + 8);
      if (big > BigInt(Number.MAX_SAFE_INTEGER)) return false;
      size = Number(big);
      header = 16;
    } else if (size === 0) {
      // Dosya sonuna kadar (yalnızca son kutu)
      size = buffer.length - offset;
    }
    if (size < header || offset + size > buffer.length) return false;
    seen.add(type);
    offset += size;
    index++;
    if (index > 10_000) return false;
  }
  return seen.has('moov') && seen.has('mdat');
}

/**
 * Yüklenen video: yeniden kodlanamaz (sunucuda video işleyici yok), bu yüzden sıkı denetlenir.
 * - En fazla 25 MB (arka plan videosu için yeterli; sayfa hızı için de sınır)
 * - İçerik imzasından tür: yalnızca MP4 (H.264/HEVC kapsayıcısı) ve WebM; uzantıya ve
 *   tarayıcının bildirdiği türe güvenilmez
 * - MP4'te kutu yapısı baştan sona doğrulanır (isWellFormedMp4)
 * Sunarken Content-Type sabit ve nosniff: tarayıcı videoyu başka bir şey gibi yorumlamaz.
 */
export async function validateVideo(
  buffer: Buffer,
): Promise<ValidatedVideoFile> {
  if (!buffer || buffer.length === 0)
    throw new BadRequestException('Dosya boş olamaz.');
  if (buffer.length > MAX_VIDEO_BYTES)
    throw new BadRequestException('Video en fazla 25 MB olabilir.');

  const detected = await fileTypeFromBuffer(buffer);
  if (detected?.mime === 'video/mp4' && detected.ext === 'mp4') {
    if (!isWellFormedMp4(buffer))
      throw new BadRequestException('Video dosyası bozuk ya da geçersiz.');
    return {
      mimeType: 'video/mp4',
      extension: 'mp4',
      size: buffer.length,
      buffer,
    };
  }
  if (detected?.mime === 'video/webm') {
    return {
      mimeType: 'video/webm',
      extension: 'webm',
      size: buffer.length,
      buffer,
    };
  }
  throw new BadRequestException('Yalnızca MP4 ve WebM videoları yüklenebilir.');
}
