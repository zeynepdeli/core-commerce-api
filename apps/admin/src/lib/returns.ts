import "server-only";

import { adminFetch } from "@/lib/api";

export type ReturnStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "RECEIVED" | "REFUNDED" | "CANCELLED";

export const RETURN_LABEL: Record<ReturnStatus, string> = {
  REQUESTED: "Yeni talep",
  APPROVED: "Onaylandı",
  REJECTED: "Reddedildi",
  RECEIVED: "Ürün geldi",
  REFUNDED: "İade edildi",
  CANCELLED: "Vazgeçildi",
};

export const RETURN_TONE: Record<ReturnStatus, string> = {
  REQUESTED: "bg-amber-500/10 text-amber-700",
  APPROVED: "bg-sky-500/10 text-sky-700",
  REJECTED: "bg-neutral-500/10 text-neutral-600",
  RECEIVED: "bg-indigo-500/10 text-indigo-700",
  REFUNDED: "bg-emerald-500/10 text-emerald-700",
  CANCELLED: "bg-neutral-500/10 text-neutral-600",
};

export type ReturnListItem = {
  id: string;
  returnNumber: string;
  status: ReturnStatus;
  reasonLabel: string;
  refundTotal: string;
  itemCount: number;
  createdAt: string;
  order: { id: string; orderNumber: string; email: string; name: string };
};

export type ReturnPage = { items: ReturnListItem[]; counts: Partial<Record<ReturnStatus, number>>; total: number; page: number; pages: number };

export type ReturnDetail = {
  id: string;
  returnNumber: string;
  status: ReturnStatus;
  reasonLabel: string;
  customerNote: string | null;
  adminNote: string | null;
  refundAmount: string;
  refundShipping: string;
  refundTotal: string;
  refundMethod: "iyzico" | "manual" | null;
  refundError: string | null;
  refundInProgress: boolean;
  autoRefund: boolean;
  restocked: boolean;
  createdAt: string;
  decidedAt: string | null;
  receivedAt: string | null;
  refundedAt: string | null;
  order: { id: string; orderNumber: string; email: string; phone: string; shippingAddress: { fullName?: string }; status: string; deliveredAt: string | null };
  items: { orderItemId: string; productName: string; variantName: string; sku: string | null; quantity: number; orderedQuantity: number; amount: string; refunded: boolean }[];
};

export async function getReturns(params: { q?: string; status?: string; page?: number }): Promise<ReturnPage> {
  const s = new URLSearchParams();
  if (params.q) s.set("q", params.q.slice(0, 100));
  if (params.status) s.set("status", params.status);
  if (params.page && params.page > 1) s.set("page", String(params.page));
  const response = await adminFetch(`/admin/returns${s.size ? `?${s}` : ""}`);
  if (!response.ok) throw new Error(`İade talepleri yüklenemedi (HTTP ${response.status}).`);
  return (await response.json()) as ReturnPage;
}

export async function getReturn(id: string): Promise<ReturnDetail | null> {
  const response = await adminFetch(`/admin/returns/${encodeURIComponent(id)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`İade talebi yüklenemedi (HTTP ${response.status}).`);
  return (await response.json()) as ReturnDetail;
}
