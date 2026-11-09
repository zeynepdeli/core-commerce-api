import "server-only";

import { adminFetch } from "@/lib/api";

export type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";
export const REVIEW_LABEL: Record<ReviewStatus, string> = { PENDING: "Onay bekliyor", APPROVED: "Yayında", REJECTED: "Reddedildi" };

export type AdminReview = {
  id: string;
  status: ReviewStatus;
  rating: number;
  title: string | null;
  comment: string;
  verifiedPurchase: boolean;
  orderId: string | null;
  rejectReason: string | null;
  reply: string | null;
  createdAt: string;
  updatedAt: string;
  product: { id: string; name: string; slug: string };
  author: { name: string; email: string; deleted: boolean };
};

export type ReviewPage = { items: AdminReview[]; counts: Partial<Record<ReviewStatus, number>>; total: number; page: number; pages: number };

export async function getReviews(params: { status?: string; q?: string; page?: number }): Promise<ReviewPage> {
  const s = new URLSearchParams();
  if (params.status) s.set("status", params.status);
  if (params.q) s.set("q", params.q.slice(0, 100));
  if (params.page && params.page > 1) s.set("page", String(params.page));
  const response = await adminFetch(`/admin/reviews${s.size ? `?${s}` : ""}`);
  if (!response.ok) throw new Error(`Yorumlar yüklenemedi (HTTP ${response.status}).`);
  return (await response.json()) as ReviewPage;
}

export async function getTopFavorites(): Promise<{ productId: string; name: string; count: number }[]> {
  const response = await adminFetch("/admin/reviews/favorites");
  return response.ok ? ((await response.json()) as { productId: string; name: string; count: number }[]) : [];
}
