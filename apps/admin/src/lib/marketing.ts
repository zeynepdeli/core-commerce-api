import "server-only";

import { adminFetch } from "@/lib/api";

export type MarketingOverview = {
  stockDemand: { variantId: string; product: string; variant: string; waiting: number; stock: number; trackStock: boolean }[];
  last30Days: { stockAlertsSent: number; cartRemindersSent: number; recoveredOrders: number; recoveredRevenue: string };
  emailOptIns: number;
  feedPath: string;
};

export async function getMarketingOverview(): Promise<MarketingOverview> {
  const response = await adminFetch("/admin/marketing");
  if (!response.ok) throw new Error(`Pazarlama verileri yüklenemedi (HTTP ${response.status}).`);
  return (await response.json()) as MarketingOverview;
}
