import { ValidateBy, isURL, type ValidationOptions } from 'class-validator';

/**
 * Site içi bağlantı kalıbı (menü, buton vb.).
 *
 * - "/" ile başlamalı
 * - "//" veya "/\" ile başlayamaz (tarayıcılar "\" karakterini "/" olarak
 *   yorumlar; "/\evil.com" => "//evil.com" => açık yönlendirme / phishing)
 * - Hiçbir yerinde ters eğik çizgi, boşluk veya kontrol karakteri olamaz
 */
export const INTERNAL_PATH_REGEX =
  // eslint-disable-next-line no-control-regex
  /^\/(?![/\\])[^\s\\\x00-\x1f\x7f?#]*(?:\?[^\s\\\x00-\x1f\x7f#]*)?(?:#[^\s\\\x00-\x1f\x7f]*)?$/;

export const INTERNAL_PATH_MESSAGE =
  'Bağlantı / ile başlayan site içi bir adres olmalıdır.';

/** Medya modülünün ürettiği yerel dosya yolu: /media/<uuid>.<uzantı> */
const LOCAL_MEDIA_REGEX =
  /^\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export function isImageUrl(value: unknown): boolean {
  if (typeof value !== 'string' || value.length > 2048) {
    return false;
  }

  if (LOCAL_MEDIA_REGEX.test(value)) {
    return true;
  }

  return isURL(value, {
    protocols: ['https'],
    require_protocol: true,
    require_tld: true,
    allow_underscores: false,
    disallow_auth: true,
  });
}

/**
 * Görsel alanları için doğrulayıcı.
 * Kabul edilenler:
 *  - Medya kütüphanesine yüklenmiş dosya: /media/<uuid>.jpg|png|webp
 *  - Harici HTTPS adresi (kullanıcı adı/şifre içeremez)
 * javascript:, data:, http: vb. şemalar reddedilir.
 */
export function IsImageUrl(validationOptions?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isImageUrl',
      validator: {
        validate: (value: unknown) => isImageUrl(value),
        defaultMessage: () =>
          'Görsel adresi medya kütüphanesinden (/media/...) veya https:// ile başlayan geçerli bir adres olmalıdır.',
      },
    },
    validationOptions,
  );
}

/** Tema renkleri için tek format: #RRGGBB (ör. #1a2b3c) */
export const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

export const HEX_COLOR_MESSAGE =
  'Renk #RRGGBB formatında olmalıdır (ör. #1a2b3c).';

/** Bölüm anahtarı: küçük harf, rakam ve tire (ör. "vizyon", "hizmetler-2") */
export const SECTION_KEY_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const SECTION_KEY_MESSAGE =
  'Anahtar yalnızca küçük harf, rakam ve tire içerebilir (ör. vizyon).';

/**
 * Yalnızca YouTube ve Vimeo video adresleri (iframe'e serbest adres girilemez).
 * Desteklenen: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID, vimeo.com/ID
 */
export const VIDEO_URL_REGEX =
  /^https:\/\/(?:(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|shorts\/|embed\/)[A-Za-z0-9_-]{11}(?:[&?][A-Za-z0-9_=&%.-]*)?|youtu\.be\/[A-Za-z0-9_-]{11}(?:\?[A-Za-z0-9_=&%.-]*)?|(?:www\.|player\.)?vimeo\.com\/(?:video\/)?\d{6,12})$/;
export const VIDEO_URL_MESSAGE = 'Yalnızca YouTube veya Vimeo video adresi girilebilir.';

// Tek satır, kontrol karakteri yok (kontrol karakterlerini yakalamak kasıtlı)
// oxlint-disable-next-line no-control-regex
export const SINGLE_LINE_REGEX = /^[^\u0000-\u001f\u007f]*$/;

/** URL parçası (slug): küçük harf, rakam ve kelimeler arasında tire (ör. "tulum-peyniri") */
export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MESSAGE =
  'Adres yalnızca küçük harf, rakam ve kelimeler arasında tire içerebilir (ör. tulum-peyniri).';

/** Prisma benzersizlik hatası (P2002) mı? */
export function isUniqueViolation(error: unknown): error is { code: 'P2002'; meta?: { target?: unknown } } {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: unknown }).code === 'P2002';
}

/**
 * Benzersizlik hatasında hangi alan çakıştı? Prisma 7 driver adapter'ı
 * kısıt adını meta.driverAdapterError.cause.constraint altında verir
 * (ör. "Category_slug_key"); eski biçimde meta.target alan listesidir.
 */
export function uniqueViolationFields(error: { meta?: unknown }): string[] {
  const meta = (error.meta ?? {}) as {
    target?: unknown;
    driverAdapterError?: { cause?: { constraint?: { index?: unknown; fields?: unknown } } };
  };
  if (Array.isArray(meta.target)) return meta.target.map(String);
  const constraint = meta.driverAdapterError?.cause?.constraint;
  if (Array.isArray(constraint?.fields)) return constraint.fields.map((f) => String(f).replace(/"/g, ''));
  if (typeof constraint?.index === 'string') {
    // "Model_alan_key" → ["alan"]
    const match = /^[A-Za-z]+_(.+)_key$/.exec(constraint.index);
    return match ? match[1].split('_') : [constraint.index];
  }
  return [];
}
