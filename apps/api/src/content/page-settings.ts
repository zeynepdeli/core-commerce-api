import { isImageUrl, isSafeLink } from '../common/validators.js';

/**
 * İletişim ve S.S.S. sayfalarının metin/görsel ayarları (SiteTheme'de JSON).
 * Okurken her alan ayrı doğrulanır: bozuk/eksik alan varsayılana döner, sayfa bozulmaz.
 * Adres, telefon, e-posta ve sosyal medya bu ayarlarda değil; Footer'daki iletişim alanlarından gelir.
 */
export const CONTACT_PAGE_DEFAULTS = {
  title: 'İletişim',
  infoSmallTitle: 'İletişim Bilgileri',
  infoTitle: 'Bize Ulaşın',
  mapTitle: 'GAZİANTEP',
  mapSubtitle: 'Merkez',
  mapImage: null as string | null,
  mapLink: null as string | null,
};

export const FAQ_PAGE_DEFAULTS = {
  title: 'SIKÇA SORULAN SORULAR',
  subtitle: 'Merak ettiğiniz tüm soruların cevaplarını burada bulabilirsiniz.',
  contactTitle: 'Hala Sorunuz Mu Var?',
  buttonText: 'Bize Yazın',
  buttonLink: '/iletisim',
};

const ONE_LINE = /^[^\p{Cc}]*$/u;
const text = (v: unknown, max: number, fallback: string) =>
  typeof v === 'string' && v.trim() && v.length <= max && ONE_LINE.test(v)
    ? v.trim()
    : fallback;
const record = (v: unknown) =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

export function parseContactPage(value: unknown) {
  const r = record(value);
  const d = CONTACT_PAGE_DEFAULTS;
  return {
    title: text(r.title, 60, d.title),
    infoSmallTitle: text(r.infoSmallTitle, 60, d.infoSmallTitle),
    infoTitle: text(r.infoTitle, 60, d.infoTitle),
    mapTitle: text(r.mapTitle, 40, d.mapTitle),
    mapSubtitle: text(r.mapSubtitle, 40, d.mapSubtitle),
    mapImage: isImageUrl(r.mapImage) ? (r.mapImage as string) : null,
    mapLink:
      typeof r.mapLink === 'string' && isSafeLink(r.mapLink) ? r.mapLink : null,
  };
}

export function parseFaqPage(value: unknown) {
  const r = record(value);
  const d = FAQ_PAGE_DEFAULTS;
  return {
    title: text(r.title, 80, d.title),
    subtitle: text(r.subtitle, 200, d.subtitle),
    contactTitle: text(r.contactTitle, 60, d.contactTitle),
    buttonText: text(r.buttonText, 30, d.buttonText),
    buttonLink:
      typeof r.buttonLink === 'string' && isSafeLink(r.buttonLink)
        ? r.buttonLink
        : d.buttonLink,
  };
}

export const CAMPAIGN_PAGE_DEFAULTS = {
  title: 'KAMPANYALAR',
  subtitle: 'Antep mutfağının en sevilen lezzetlerinde size özel fırsatlar.',
  saleTitle: 'İndirimdeki Ürünler',
  emptyText: 'Şu anda aktif bir kampanya yok. Yeni fırsatlar için bizi takip edin.',
};

export function parseCampaignPage(value: unknown) {
  const r = record(value);
  const d = CAMPAIGN_PAGE_DEFAULTS;
  return {
    title: text(r.title, 80, d.title),
    subtitle: text(r.subtitle, 200, d.subtitle),
    saleTitle: text(r.saleTitle, 60, d.saleTitle),
    emptyText: text(r.emptyText, 200, d.emptyText),
  };
}
