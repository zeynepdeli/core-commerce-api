import "server-only";

import { adminFetch } from "@/lib/api";

export type Role = "CUSTOMER" | "ADMIN" | "SUPER_ADMIN";

export type UserRow = {
  id: string;
  email: string;
  name: string;
  role: Role;
  signupMethod: "LOCAL" | "GOOGLE";
  emailVerifiedAt: string | null;
  isActive: boolean;
  deletedAt: string | null;
  lockedUntil: string | null;
  failedLoginCount: number;
  createdAt: string;
};

export type UserPage = { items: UserRow[]; total: number; page: number; limit: number; pages: number };

export async function getUsers(params: { q?: string; role?: string; status?: string; page?: number }): Promise<UserPage> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q.slice(0, 100));
  if (params.role) search.set("role", params.role);
  if (params.status) search.set("status", params.status);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const qs = search.toString();
  const response = await adminFetch(`/admin/users${qs ? `?${qs}` : ""}`);
  if (!response.ok) throw new Error(`Kullanıcılar yüklenemedi (HTTP ${response.status}).`);
  return (await response.json()) as UserPage;
}
