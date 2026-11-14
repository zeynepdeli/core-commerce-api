import { isImageUrl } from '../common/validators.js';

/**
 * Mağazanın tasarım görselleri (admin → Site Görselleri).
 * İzinli liste: mağaza yalnızca bu adları tanır; boş bırakılan alan için mağaza kendi
 * varsayılan görselini kullanır. Yeni bir alan eklenince mağazada da karşılığı yazılmalı.
 *
 * Logo, site arka planı ve kart dokusu SiteTheme'in kendi sütunlarında (eskiden beri);
 * bunlar onların yanına eklenen yeni alanlar.
 */
export const SITE_IMAGE_SLOTS = [
  'footerBackground',
  'productBandBackground',
  'productPlate',
  'iconTexture',
] as const;
export type SiteImageSlot = (typeof SITE_IMAGE_SLOTS)[number];
export type SiteImages = Partial<Record<SiteImageSlot, string>>;

/** Veritabanındaki JSON'u güvenle okur: bilinmeyen ad ya da medya/https olmayan adres atlanır. */
export function parseSiteImages(value: unknown): SiteImages {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return {};
  const record = value as Record<string, unknown>;
  const images: SiteImages = {};
  for (const slot of SITE_IMAGE_SLOTS) {
    const url = record[slot];
    if (isImageUrl(url)) images[slot] = url as string;
  }
  return images;
}

/**
 * Admin'in gönderdiği değişiklikleri mevcut kayda uygular.
 * - Gönderilmeyen alan olduğu gibi kalır
 * - null / "" → alan silinir (mağaza varsayılana döner)
 * - adres → yazılır (DTO'da IsImageUrl ile doğrulanmış olmalı)
 */
export function mergeSiteImages(
  current: unknown,
  changes: Partial<Record<SiteImageSlot, string | null | undefined>>,
): SiteImages {
  const next = parseSiteImages(current);
  for (const slot of SITE_IMAGE_SLOTS) {
    if (!(slot in changes) || changes[slot] === undefined) continue;
    const url = changes[slot];
    if (url) next[slot] = url;
    else delete next[slot];
  }
  return next;
}
