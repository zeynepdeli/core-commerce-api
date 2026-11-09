import { BadRequestException, type ValidationError } from '@nestjs/common';

/**
 * class-validator'ın İngilizce varsayılan mesajlarını Türkçeleştirir.
 * DTO'da özel (Türkçe) mesaj verilmiş kurallara dokunmaz. Mesajda alan
 * yolu korunur ("billing.fullName: …") ki mağaza hatayı doğru alana bağlayabilsin.
 */
const TR: Record<string, (c: Record<string, unknown>) => string> = {
  isString: () => 'metin olmalıdır',
  isNotEmpty: () => 'boş olamaz',
  minLength: (c) => `en az ${String(c.min ?? '')} karakter olmalıdır`,
  maxLength: (c) => `en fazla ${String(c.max ?? '')} karakter olabilir`,
  isEmail: () => 'geçerli bir e-posta adresi olmalıdır',
  isUuid: () => 'geçersiz kimlik',
  isInt: () => 'tam sayı olmalıdır',
  isNumber: () => 'sayı olmalıdır',
  isBoolean: () => 'evet/hayır (true/false) olmalıdır',
  isIn: () => 'izin verilen değerlerden biri olmalıdır',
  isDate: () => 'geçerli bir tarih olmalıdır',
  isArray: () => 'liste olmalıdır',
  min: (c) => `en az ${String(c.min ?? '')} olmalıdır`,
  max: (c) => `en fazla ${String(c.max ?? '')} olabilir`,
  matches: () => 'biçimi geçersiz',
  arrayMinSize: () => 'en az bir öğe içermelidir',
  arrayMaxSize: () => 'çok fazla öğe içeriyor',
  whitelistValidation: () => 'bu alan kabul edilmiyor',
  nestedValidation: () => 'geçersiz',
};

const DEFAULT_MESSAGE = /^(?:[\w.$[\]]+ )?(?:must|should|has|each value|property|an instance)/i;

function collect(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((error) => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.entries(error.constraints ?? {}).map(([key, message]) =>
      DEFAULT_MESSAGE.test(message) && TR[key] ? `${path}: ${TR[key]((error.contexts?.[key] as Record<string, unknown>) ?? constraintsOf(message))}` : message,
    );
    return [...own, ...collect(error.children ?? [], path)];
  });
}

/** "must be shorter than or equal to 100 characters" → { max: 100 } */
function constraintsOf(message: string): Record<string, unknown> {
  const n = /(\d+)/.exec(message)?.[1];
  return { min: n, max: n };
}

export function validationExceptionFactory(errors: ValidationError[]) {
  return new BadRequestException(collect(errors));
}
