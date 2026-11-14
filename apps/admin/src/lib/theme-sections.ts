import type { LucideIcon } from "lucide-react";
import { Image as ImageIcon, PanelTop, Search, SwatchBook } from "lucide-react";

/** Görünüm ayarlarının alanları (API: PUT /admin/content/site) */
export type ThemeValues = {
  siteName: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontHeading: string;
  fontBody: string;
  logoUrl: string;
  faviconUrl: string;
  backgroundImageUrl: string;
  backgroundImageFit: string;
  cardTextureUrl: string;
  ogImageUrl: string;
  announcementText: string;
  announcementLink: string;
  headerLinks: { label: string; href: string }[];
  metaTitle: string;
  metaDescription: string;
};

/**
 * Görünüm dört ayrı ekranda düzenlenir (dashboard'da dört kutu).
 * Her ekran yalnızca kendi alanlarını gönderir; diğer ayarlara dokunulmaz.
 * Ne sunucu ne istemciye özel: hem sayfa (sunucu) hem form (istemci) kullanır.
 */
export const THEME_SECTIONS = {
  header: {
    title: "Header",
    description: "Mağaza adı, logo, menü linkleri, duyuru şeridi",
    icon: PanelTop,
    fields: ["siteName", "logoUrl", "faviconUrl", "headerLinks", "announcementText", "announcementLink"],
  },
  renkler: {
    title: "Renkler ve Yazı Tipleri",
    description: "Ana renk, vurgu rengi, zemin, metin, yazı tipleri",
    icon: SwatchBook,
    fields: ["primaryColor", "secondaryColor", "backgroundColor", "textColor", "fontHeading", "fontBody"],
  },
  "arka-plan": {
    title: "Site Arka Planı",
    description: "Genel arka plan görseli ve kart dokusu",
    icon: ImageIcon,
    fields: ["backgroundImageUrl", "backgroundImageFit", "cardTextureUrl"],
  },
  seo: {
    title: "SEO",
    description: "Arama motoru başlığı, açıklaması, paylaşım görseli",
    icon: Search,
    fields: ["metaTitle", "metaDescription", "ogImageUrl"],
  },
} as const satisfies Record<string, { title: string; description: string; icon: LucideIcon; fields: readonly (keyof ThemeValues)[] }>;

export type ThemeSection = keyof typeof THEME_SECTIONS;

export const isThemeSection = (v: string): v is ThemeSection => Object.hasOwn(THEME_SECTIONS, v);
