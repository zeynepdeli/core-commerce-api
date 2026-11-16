import type { LucideIcon } from "lucide-react";
import { BadgePercent, CircleHelp, Image as ImageIcon, Mail, PanelTop, Search, ShoppingBag, SwatchBook } from "lucide-react";

/** API'deki izinli liste ile aynı (apps/api/src/content/site-images.ts) */
export const SITE_IMAGE_SLOTS = ["productBandBackground", "productPlate", "footerBackground", "iconTexture", "productPageBackground", "productDecorOne", "productDecorTwo"] as const;
export type SiteImageSlot = (typeof SITE_IMAGE_SLOTS)[number];

/**
 * Site Görselleri ekranındaki her görsel: ad, açıklama ve boşken mağazada görünen varsayılan
 * (mağazanın /images klasöründeki dosya; önizleme STOREFRONT_URL üzerinden).
 */
export const SITE_IMAGE_FIELDS = [
  { name: "backgroundImageUrl", label: "Site arka planı", hint: "Tüm sayfaların arkasındaki manzara.", fallback: "/images/antep-kalesi.webp" },
  { name: "cardTextureUrl", label: "Kart dokusu", hint: "Butonlar, kartlar, menü ve arama kutusundaki kâğıt dokusu.", fallback: "/images/kart-doku.webp" },
  { name: "siteImages.productBandBackground", label: "Ürün bandı zemini", hint: "Ana sayfadaki ürün listelerinin arkasındaki duvar.", fallback: "/images/duvar-zemin.webp" },
  { name: "siteImages.productPlate", label: "Ürün tabağı", hint: "Ürün görselinin altındaki bakır tabak. Arka planı şeffaf PNG/WEBP olmalı.", fallback: "/images/bakir-tabak.webp" },
  { name: "siteImages.footerBackground", label: "Footer zemini", hint: "Sayfanın en altındaki görsel.", fallback: "/images/footer-merdiven.webp" },
  { name: "siteImages.iconTexture", label: "Bakır ikon dokusu", hint: "Header'daki yuvarlak ikonların dokusu.", fallback: "/images/bakir-doku.webp" },
] as const satisfies readonly { name: "backgroundImageUrl" | "cardTextureUrl" | `siteImages.${SiteImageSlot}`; label: string; hint: string; fallback: string }[];

/** Ürün detay sayfasının görselleri (Ürün Sayfası ekranı). Boşken mağazanın varsayılanı. */
export const PRODUCT_PAGE_IMAGE_FIELDS = [
  { name: "siteImages.productPageBackground", label: "Sayfa arka planı", hint: "Ürün sayfasının arkasındaki görsel (hafif soluk görünür).", fallback: "/images/hero-zemin.webp" },
  { name: "siteImages.productDecorOne", label: "Dekor çizimi 1", hint: "Solda üstteki silik çizim. Arka planı şeffaf PNG/WEBP olmalı.", fallback: "/images/kadin-cizim.webp" },
  { name: "siteImages.productDecorTwo", label: "Dekor çizimi 2", hint: "Solda alttaki, hafif eğik silik çizim.", fallback: "/images/kadin-cizim.webp" },
] as const satisfies readonly { name: `siteImages.${SiteImageSlot}`; label: string; hint: string; fallback: string }[];

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
  siteImages: Record<SiteImageSlot, string>;
  ogImageUrl: string;
  announcementText: string;
  announcementLink: string;
  headerLinks: { label: string; href: string }[];
  showDelivery: boolean;
  deliveryTitle: string;
  deliveryText: string;
  deliveryLink: string;
  deliveryIconUrl: string;
  searchPlaceholder: string;
  loginText: string;
  accountText: string;
  cartText: string;
  productLabelText: string;
  addToCartText: string;
  buyNowText: string;
  quantityText: string;
  contactPage: { title: string; infoSmallTitle: string; infoTitle: string; mapTitle: string; mapSubtitle: string; mapImage: string; mapLink: string };
  faqPage: { title: string; subtitle: string; contactTitle: string; buttonText: string; buttonLink: string };
  campaignPage: { title: string; subtitle: string; saleTitle: string; emptyText: string };
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
    description: "Logo, menü linkleri, teslimat kutusu, yazılar, duyuru şeridi",
    icon: PanelTop,
    fields: [
      "siteName",
      "logoUrl",
      "faviconUrl",
      "headerLinks",
      "showDelivery",
      "deliveryTitle",
      "deliveryText",
      "deliveryLink",
      "deliveryIconUrl",
      "searchPlaceholder",
      "loginText",
      "accountText",
      "cartText",
      "announcementText",
      "announcementLink",
    ],
  },
  renkler: {
    title: "Renkler ve Yazı Tipleri",
    description: "Ana renk, vurgu rengi, zemin, metin, yazı tipleri",
    icon: SwatchBook,
    fields: ["primaryColor", "secondaryColor", "backgroundColor", "textColor", "fontHeading", "fontBody"],
  },
  "arka-plan": {
    title: "Site Görselleri",
    description: "Arka plan, dokular, ürün tabağı, footer zemini",
    icon: ImageIcon,
    fields: ["backgroundImageUrl", "backgroundImageFit", "cardTextureUrl", "siteImages"],
  },
  "urun-sayfasi": {
    title: "Ürün Sayfası",
    description: "Ürün detay sayfasının arka planı, dekorları, etiket ve düğme yazıları",
    icon: ShoppingBag,
    fields: ["productLabelText", "addToCartText", "buyNowText", "quantityText", "siteImages"],
  },
  iletisim: {
    title: "İletişim Sayfası",
    description: "Sayfa başlığı, harita görseli ve yazısı, konum bağlantısı",
    icon: Mail,
    fields: ["contactPage"],
  },
  sss: {
    title: "S.S.S. Sayfası",
    description: "Başlık, açıklama ve alttaki “Hala sorunuz mu var?” kutusu",
    icon: CircleHelp,
    fields: ["faqPage"],
    parent: { href: "/content/faq", label: "S.S.S." },
  },
  kampanyalar: {
    title: "Kampanyalar Sayfası",
    description: "Başlık, açıklama, indirimli ürünler başlığı ve boş durum yazısı",
    icon: BadgePercent,
    fields: ["campaignPage"],
    parent: { href: "/content/campaigns", label: "Kampanyalar" },
  },
  seo: {
    title: "SEO",
    description: "Arama motoru başlığı, açıklaması, paylaşım görseli",
    icon: Search,
    fields: ["metaTitle", "metaDescription", "ogImageUrl"],
  },
} as const satisfies Record<string, { title: string; description: string; icon: LucideIcon; fields: readonly (keyof ThemeValues)[]; parent?: { href: string; label: string } }>;

export type ThemeSection = keyof typeof THEME_SECTIONS;

export const isThemeSection = (v: string): v is ThemeSection => Object.hasOwn(THEME_SECTIONS, v);
