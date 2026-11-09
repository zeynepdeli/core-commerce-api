import { BadRequestException, type PipeTransform } from '@nestjs/common';

import { SLUG_REGEX } from './validators.js';

/** URL'deki :slug parametresini doğrular (veritabanına serbest metin gitmez). */
export class ParseSlugPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    if (typeof value !== 'string' || value.length > 150 || !SLUG_REGEX.test(value)) {
      throw new BadRequestException('Geçersiz adres.');
    }
    return value;
  }
}
