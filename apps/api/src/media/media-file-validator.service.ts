import { BadRequestException, Injectable } from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';

export type ValidatedMediaFile = {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: 'jpg' | 'png' | 'webp';
  size: number;
  width: number;
  height: number;
  buffer: Buffer;
};

/**
 * Yüklenen görsel her zaman yeniden kodlanır:
 * - Dosyaya gizlenmiş içerik (polyglot, script) temizlenir
 * - EXIF/GPS gibi kişisel meta veriler silinir (sharp varsayılanı)
 * - En uzun kenar 2560 px'e küçültülür → sayfalar hızlı yüklenir (performans)
 */
const MAX_OUTPUT_EDGE = 2560;

@Injectable()
export class MediaFileValidatorService {
  private readonly maxFileSize = 5 * 1024 * 1024;
  private readonly maxDimension = 8000;
  private readonly maxPixels = 40_000_000;

  private readonly allowedTypes = new Map([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
  ]);

  async validate(buffer: Buffer): Promise<ValidatedMediaFile> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Dosya boş olamaz.');
    }

    if (buffer.length > this.maxFileSize) {
      throw new BadRequestException('Dosya boyutu en fazla 5 MB olabilir.');
    }

    const detectedType = await fileTypeFromBuffer(buffer);
    const extension = detectedType
      ? this.allowedTypes.get(detectedType.mime)
      : undefined;

    if (!extension || !detectedType) {
      throw new BadRequestException(
        'Yalnızca JPEG, PNG ve WebP görselleri yüklenebilir.',
      );
    }

    try {
      const image = sharp(buffer, {
        failOn: 'error',
        limitInputPixels: this.maxPixels,
        animated: false,
      });

      const metadata = await image.metadata();

      if (
        !metadata.width ||
        !metadata.height ||
        metadata.width > this.maxDimension ||
        metadata.height > this.maxDimension
      ) {
        throw new BadRequestException(
          'Görsel boyutları en fazla 8000x8000 olabilir.',
        );
      }

      if (metadata.width * metadata.height > this.maxPixels) {
        throw new BadRequestException(
          'Görsel en fazla 40 milyon piksel olabilir.',
        );
      }

      if (metadata.format !== extension.replace('jpg', 'jpeg')) {
        throw new BadRequestException('Görsel formatı geçersiz.');
      }

      // EXIF yönünü uygula (telefon fotoğrafları yan dönmesin), sonra küçült
      const pipeline = image.rotate().resize({
        width: MAX_OUTPUT_EDGE,
        height: MAX_OUTPUT_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      });

      let output: { data: Buffer; info: { width: number; height: number } };

      switch (extension) {
        case 'jpg':
          output = await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer({ resolveWithObject: true });
          break;
        case 'png':
          output = await pipeline.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true });
          break;
        case 'webp':
          output = await pipeline.webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
          break;
        default:
          throw new BadRequestException('Desteklenmeyen görsel formatı.');
      }
      const processed = output.data;

      if (processed.length > this.maxFileSize) {
        throw new BadRequestException(
          'İşlenen görselin boyutu 5 MB sınırını aşıyor.',
        );
      }

      return {
        mimeType: detectedType.mime as ValidatedMediaFile['mimeType'],
        extension: extension as ValidatedMediaFile['extension'],
        size: processed.length,
        width: output.info.width,
        height: output.info.height,
        buffer: processed,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Görsel dosyası bozuk veya işlenemiyor.');
    }
  }
}
