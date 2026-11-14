import { isSafeLink, SINGLE_LINE_REGEX } from '../common/validators.js';

/** Satır taşmasın diye header menüsünde en fazla bu kadar link olur. */
export const MAX_HEADER_LINKS = 8;
export const MAX_HEADER_LABEL = 30;

export type HeaderLink = { label: string; href: string };

/**
 * Veritabanındaki JSON'u güvenle okur: biçimi bozuk, boş adlı ya da güvensiz adresli
 * (javascript:, //kotu.site, http:// …) kayıtlar atlanır. Yazarken DTO zaten doğrular;
 * bu ikinci kat, elle düzenlenmiş ya da eski kayıtlar mağazaya sızmasın diye.
 */
export function parseHeaderLinks(value: unknown): HeaderLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item: unknown) => {
      if (typeof item !== 'object' || item === null) return [];
      const { label, href } = item as Record<string, unknown>;
      if (typeof label !== 'string' || typeof href !== 'string') return [];
      const name = label.trim();
      if (
        !name ||
        name.length > MAX_HEADER_LABEL ||
        !SINGLE_LINE_REGEX.test(name) ||
        !isSafeLink(href)
      )
        return [];
      return [{ label: name, href }];
    })
    .slice(0, MAX_HEADER_LINKS);
}
