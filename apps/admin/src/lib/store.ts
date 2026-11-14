import "server-only";

import { adminFetch } from "@/lib/api";

export type StoreSettings = {
  shippingFee: string;
  freeShippingThreshold: string | null;
  minOrderAmount: string | null;
  paymentTimeoutMinutes: number;
  returnWindowDays: number;
  abandonedCartEnabled: boolean;
  abandonedCartDelayHours: number;
  productFeedEnabled: boolean;
  feedBrand: string | null;
  reviewAutoApprove: boolean;
  sellerName: string | null;
  sellerAddress: string | null;
  sellerPhone: string | null;
  sellerEmail: string | null;
  sellerTaxOffice: string | null;
  sellerTaxNumber: string | null;
  sellerMersisNo: string | null;
  sellerKepAddress: string | null;
};

export type LegalDoc = { type: "PRE_INFORMATION" | "DISTANCE_SALES" | "KVKK_NOTICE" | "COOKIE_POLICY"; title: string; content: string; version: number };

export async function getLegalDocs(): Promise<{ documents: LegalDoc[]; placeholders: string[] }> {
  const response = await adminFetch("/admin/legal");
  if (!response.ok) throw new Error(`Metinler yüklenemedi (HTTP ${response.status}).`);
  return (await response.json()) as { documents: LegalDoc[]; placeholders: string[] };
}

export async function getStoreSettings(): Promise<StoreSettings> {
  const response = await adminFetch("/admin/store-settings");
  if (!response.ok) throw new Error(`Ayarlar yüklenemedi (HTTP ${response.status}).`);
  return (await response.json()) as StoreSettings;
}

export type Coupon = {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED" | "FREE_SHIPPING";
  value: string;
  maxDiscount: string | null;
  minSubtotal: string | null;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  usedCount: number;
  isActive: boolean;
};

export async function getCoupons(page = 1, q = ""): Promise<{ items: Coupon[]; total: number; page: number; pages: number }> {
  const search = new URLSearchParams();
  if (q) search.set("q", q.slice(0, 32));
  if (page > 1) search.set("page", String(page));
  const response = await adminFetch(`/admin/coupons${search.size ? `?${search}` : ""}`);
  if (!response.ok) throw new Error(`Kuponlar yüklenemedi (HTTP ${response.status}).`);
  return (await response.json()) as { items: Coupon[]; total: number; page: number; pages: number };
}
