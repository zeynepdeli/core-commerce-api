import { BadRequestException } from '@nestjs/common';

import {
  FOOTER_ICON_HOSTS,
  FOOTER_ICONS,
  type FooterIcon,
} from './content.dto.js';

export type FooterLink = { icon: FooterIcon; label: string; url: string };

const isFooterIcon = (v: unknown): v is FooterIcon =>
  typeof v === 'string' && (FOOTER_ICONS as readonly string[]).includes(v);

/**
 * Yöneticinin girdiği bağlantıyı doğrular ve normalleştirir (DTO alanları zaten doğrulanmış olmalı).
 * - Yalnızca https, kullanıcı adı/şifre içeremez ("https://instagram.com@kotu.site" gibi aldatmacalar)
 * - Marka ikonunda adres o markanın alan adında olmalı; "web" ikonunda alan adı serbest
 */
export function normalizeFooterLink(link: FooterLink): FooterLink {
  let url: URL;
  try {
    url = new URL(link.url);
  } catch {
    throw new BadRequestException(`${link.label} bağlantısı geçersiz.`);
  }
  const hosts = FOOTER_ICON_HOSTS[link.icon];
  const validHost = hosts
    ? hosts.includes(url.hostname)
    : url.hostname.includes('.');
  if (url.protocol !== 'https:' || url.username || url.password || !validHost) {
    throw new BadRequestException(
      hosts
        ? `${link.label} bağlantısı https://${hosts[0]}/… biçiminde olmalı.`
        : `${link.label} bağlantısı https:// ile başlayan bir web adresi olmalı.`,
    );
  }
  return { icon: link.icon, label: link.label, url: url.toString() };
}

/** Veritabanındaki JSON'u güvenle okur: biçimi bozuk ya da bilinmeyen ikonlu kayıtlar atlanır. */
export function parseFooterLinks(value: unknown): FooterLink[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown) => {
    if (typeof item !== 'object' || item === null) return [];
    const { icon, label, url } = item as Record<string, unknown>;
    if (
      !isFooterIcon(icon) ||
      typeof label !== 'string' ||
      typeof url !== 'string' ||
      !url.startsWith('https://')
    )
      return [];
    return [{ icon, label, url }];
  });
}
