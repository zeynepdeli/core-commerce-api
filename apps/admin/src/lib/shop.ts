import "server-only";

import { adminFetch } from "@/lib/api";
import type { CategoryFormValues, ProductFormValues } from "@/lib/validations/shop.schema";

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  isActive: boolean;
  order: number;
  metaTitle: string | null;
  metaDescription: string | null;
  productCount: number;
};

export type ProductListItem = {
  id: string;
  name: string;
  slug: string;
  price: string;
  compareAtPrice: string | null;
  vatRate: number;
  isActive: boolean;
  featured: boolean;
  image: { url: string; alt: string | null } | null;
  category: { id: string; name: string } | null;
  variantCount: number;
  variantName: string | null;
  sku: string | null;
  totalStock: number | null;
  lowStock: boolean;
};

export type ProductPage = { items: ProductListItem[]; total: number; page: number; limit: number; pages: number };

export type Variant = {
  id: string;
  name: string;
  sku: string | null;
  price: string;
  compareAtPrice: string | null;
  stock: number;
  trackStock: boolean;
  isActive: boolean;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  summary: string | null;
  description: string | null;
  categoryId: string;
  vatRate: number;
  isActive: boolean;
  featured: boolean;
  isReturnable: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  images: { url: string; alt: string | null }[];
  tabs: { title: string; body: string }[];
  variants: Variant[];
};

async function getJson<T>(path: string, what: string): Promise<T | null> {
  const response = await adminFetch(path);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${what} yüklenemedi (HTTP ${response.status}).`);
  return (await response.json()) as T;
}

export async function getAdminCategories(): Promise<Category[]> {
  return (await getJson<Category[]>("/admin/shop/categories", "Kategoriler")) ?? [];
}

export async function getAdminProducts(params: { q?: string; category?: string; status?: string; page?: number }) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q.slice(0, 100));
  if (params.category) search.set("category", params.category);
  if (params.status) search.set("status", params.status);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const qs = search.toString();
  return (
    (await getJson<ProductPage>(`/admin/shop/products${qs ? `?${qs}` : ""}`, "Ürünler")) ?? {
      items: [],
      total: 0,
      page: 1,
      limit: 25,
      pages: 1,
    }
  );
}

export async function getAdminProduct(id: string): Promise<Product | null> {
  return getJson<Product>(`/admin/shop/products/${encodeURIComponent(id)}`, "Ürün");
}

export function toCategoryFormValues(c: Category): CategoryFormValues {
  return {
    name: c.name,
    slug: c.slug,
    description: c.description ?? "",
    image: c.image ?? "",
    isActive: c.isActive,
    metaTitle: c.metaTitle ?? "",
    metaDescription: c.metaDescription ?? "",
  };
}

/** "249.90" → "249,90", "250.00" → "250" (formda Türkçe yazım) */
const priceInput = (v: string | null) => (v == null ? "" : v.replace(/\.00$/, "").replace(".", ","));

export function toProductFormValues(p: Product): ProductFormValues {
  return {
    name: p.name,
    slug: p.slug,
    summary: p.summary ?? "",
    description: p.description ?? "",
    categoryId: p.categoryId,
    vatRate: String(p.vatRate) as ProductFormValues["vatRate"],
    isActive: p.isActive,
    featured: p.featured,
    isReturnable: p.isReturnable,
    metaTitle: p.metaTitle ?? "",
    metaDescription: p.metaDescription ?? "",
    variants: p.variants.map((v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku ?? "",
      price: priceInput(v.price),
      compareAtPrice: priceInput(v.compareAtPrice),
      stock: String(v.stock),
      trackStock: v.trackStock,
      isActive: v.isActive,
    })),
    images: p.images.map((i) => ({ url: i.url, alt: i.alt ?? "" })),
    tabs: p.tabs,
  };
}

const priceFormat = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" });

/** "1249.9" → "1.249,90 ₺" */
export function formatPrice(value: string | null): string {
  return value == null ? "" : priceFormat.format(Number(value));
}
