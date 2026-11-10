import "server-only";

import { adminFetch } from "@/lib/api";

export type SiteSettings = {
  siteName: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  backgroundImageUrl: string | null;
  backgroundImageFit: string;
  cardTextureUrl: string | null;
  fontHeading: string;
  fontBody: string;
  logoUrl: string;
  faviconUrl: string;
  announcementText: string | null;
  announcementLink: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactWhatsapp: string | null;
  contactAddress: string | null;
  workingHours: string | null;
  socialLinks: Record<string, string>;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImageUrl: string | null;
};

export type ContentOptions = { fonts: string[]; blockTypes: string[]; featureIcons: string[]; socialNetworks: string[] };
export type Block = { id: string; key: string; data: { type: string; [k: string]: unknown }; order: number; isActive: boolean; updatedAt: string };
export type PageRow = { id: string; slug: string; title: string; isPublished: boolean; showInFooter: boolean; order: number; updatedAt: string };
export type PageDetail = PageRow & { body: string; metaTitle: string | null; metaDescription: string | null };
export type Faq = { id: string; question: string; answer: string; category: string | null; isActive: boolean; order: number };

async function json<T>(path: string, what: string): Promise<T> {
  const response = await adminFetch(path);
  if (!response.ok) throw new Error(`${what} yüklenemedi (HTTP ${response.status}).`);
  return (await response.json()) as T;
}

export const getSite = () => json<SiteSettings>("/admin/content/site", "Görünüm");
export const getContentOptions = () => json<ContentOptions>("/admin/content/options", "Seçenekler");
export const getBlocks = () => json<Block[]>("/admin/content/home", "Ana sayfa");
export const getPages = () => json<PageRow[]>("/admin/content/pages", "Sayfalar");
export const getFaq = () => json<Faq[]>("/admin/content/faq", "S.S.S.");

export async function getBlock(id: string): Promise<Block | null> {
  const r = await adminFetch(`/admin/content/home/${encodeURIComponent(id)}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Bölüm yüklenemedi (HTTP ${r.status}).`);
  return (await r.json()) as Block;
}

export async function getPage(id: string): Promise<PageDetail | null> {
  const r = await adminFetch(`/admin/content/pages/${encodeURIComponent(id)}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Sayfa yüklenemedi (HTTP ${r.status}).`);
  return (await r.json()) as PageDetail;
}

export const BLOCK_LABEL: Record<string, string> = {
  HERO: "Büyük görsel / slayt",
  PRODUCT_LIST: "Ürün listesi",
  CATEGORY_GRID: "Kategoriler",
  BANNER: "Banner",
  TEXT: "Metin",
  FEATURES: "Avantajlar (ikonlu)",
};
