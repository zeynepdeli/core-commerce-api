import "server-only";

import { adminFetch, readApiError } from "@/lib/api";

export type SalesReport = {
  range: { from: string; to: string; days: number; groupBy: "day" | "week" | "month"; timezone: string };
  previous: { from: string; to: string };
  summary: {
    orders: number;
    gross: string;
    net: string;
    refunds: string;
    returnRefunds: string;
    cancelRefunds: string;
    returnCount: number;
    cancelCount: number;
    subtotal: string;
    discount: string;
    shipping: string;
    vat: string;
    aov: string;
    itemsSold: number;
    customers: number;
  };
  change: { orders: number | null; gross: number | null; net: number | null; aov: number | null; itemsSold: number | null };
  series: { date: string; orders: number; revenue: string }[];
  topProducts: { productId: string; name: string; quantity: number; orders: number; revenue: string }[];
  categories: { categoryId: string; name: string; quantity: number; revenue: string }[];
  coupons: { code: string; uses: number; discount: string; revenue: string }[];
  customers: { new: number; returning: number; memberOrders: number; guestOrders: number };
  funnel: { created: number; paid: number; abandoned: number; pending: number; failedPayments: number; conversion: number | null };
};

export const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export async function getSalesReport(params: { from: string; to: string; groupBy?: string }): Promise<{ report: SalesReport } | { error: string }> {
  const s = new URLSearchParams({ from: params.from, to: params.to });
  if (params.groupBy) s.set("groupBy", params.groupBy);
  const response = await adminFetch(`/admin/reports/sales?${s}`);
  if (!response.ok) return { error: await readApiError(response, "Rapor yüklenemedi.") };
  return { report: (await response.json()) as SalesReport };
}
