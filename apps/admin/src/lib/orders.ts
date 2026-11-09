import "server-only";

import { adminFetch } from "@/lib/api";

export type OrderStatus = "PENDING" | "PAID" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Ödeme bekleniyor",
  PAID: "Ödeme alındı",
  PROCESSING: "Hazırlanıyor",
  SHIPPED: "Kargoda",
  DELIVERED: "Teslim edildi",
  CANCELLED: "İptal",
  REFUNDED: "İade edildi",
};

export const STATUS_TONE: Record<OrderStatus, string> = {
  PENDING: "bg-amber-500/10 text-amber-700",
  PAID: "bg-sky-500/10 text-sky-700",
  PROCESSING: "bg-indigo-500/10 text-indigo-700",
  SHIPPED: "bg-violet-500/10 text-violet-700",
  DELIVERED: "bg-emerald-500/10 text-emerald-700",
  CANCELLED: "bg-neutral-500/10 text-neutral-600",
  REFUNDED: "bg-rose-500/10 text-rose-700",
};

export type OrderListItem = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  customerName: string;
  email: string;
  guest: boolean;
  total: string;
  itemCount: number;
  createdAt: string;
  paymentDueAt: string | null;
};

export type OrderPage = {
  items: OrderListItem[];
  total: number;
  page: number;
  pages: number;
  statusCounts: Partial<Record<OrderStatus, number>>;
};

export type Address = { fullName: string; phone: string; city: string; district: string; addressLine: string; zipCode: string | null };
export type Billing = {
  type: "INDIVIDUAL" | "CORPORATE";
  fullName: string | null;
  identityNumber: string | null;
  companyName: string | null;
  taxOffice: string | null;
  taxNumber: string | null;
  city: string | null;
  district: string | null;
  addressLine: string | null;
};

export type OrderDetail = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  nextStatuses: { status: OrderStatus; label: string }[];
  createdAt: string;
  paymentDueAt: string | null;
  cancelReason: string | null;
  customer: { id: string; name: string; email: string } | null;
  email: string;
  phone: string;
  shippingAddress: Address;
  billingInfo: Billing;
  customerNote: string | null;
  couponCode: string | null;
  shippingCarrier: string | null;
  trackingNumber: string | null;
  items: { productId: string; productName: string; variantName: string; sku: string | null; vatRate: number; quantity: number; unitPrice: string; lineTotal: string }[];
  subtotal: string;
  discount: string;
  shippingFee: string;
  vatTotal: string;
  total: string;
  timeline: { status: OrderStatus; label: string; note: string | null; at: string; actor: string | null }[];
  agreements: { type: string; version: number; contentHash: string; acceptedAt: string; ipAddress: string | null; content: string }[];
  payment: {
    provider: string;
    status: "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";
    providerPaymentId: string | null;
    summary: { paidPrice?: string; installment?: number; cardAssociation?: string | null; lastFourDigits?: string | null } | null;
    errorMessage: string | null;
    paidAt: string | null;
    initiatedAt: string | null;
  } | null;
};

export async function getOrders(params: { q?: string; status?: string; page?: number }): Promise<OrderPage> {
  const s = new URLSearchParams();
  if (params.q) s.set("q", params.q.slice(0, 100));
  if (params.status) s.set("status", params.status);
  if (params.page && params.page > 1) s.set("page", String(params.page));
  const response = await adminFetch(`/admin/orders${s.size ? `?${s}` : ""}`);
  if (!response.ok) throw new Error(`Siparişler yüklenemedi (HTTP ${response.status}).`);
  return (await response.json()) as OrderPage;
}

export async function getOrder(id: string): Promise<OrderDetail | null> {
  const response = await adminFetch(`/admin/orders/${encodeURIComponent(id)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Sipariş yüklenemedi (HTTP ${response.status}).`);
  return (await response.json()) as OrderDetail;
}
