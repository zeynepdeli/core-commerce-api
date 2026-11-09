import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { ACCESS_COOKIE } from "@/lib/session-cookies";

export type AdminRole = "ADMIN" | "SUPER_ADMIN";
export type AdminUser = { id: string; email: string; name: string; role: AdminRole };

export const isAdminRole = (role: unknown): role is AdminRole => role === "ADMIN" || role === "SUPER_ADMIN";

/**
 * Giriş yapmış yönetici (yoksa null). Rol her istekte API'den okunur;
 * yetkisi alınan kişi bir sonraki sayfa açılışında paneli kaybeder.
 * Aynı istek içinde tekrar çağrılırsa API'ye tek kez gidilir (cache).
 */
export const getAdminUser = cache(async (): Promise<AdminUser | null> => {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const apiUrl = process.env.API_URL?.replace(/\/$/, "");
  if (!token || !apiUrl) return null;

  try {
    const response = await fetch(`${apiUrl}/account/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const user = (await response.json()) as Partial<AdminUser>;
    if (typeof user.id !== "string" || typeof user.email !== "string" || !isAdminRole(user.role)) return null;
    return { id: user.id, email: user.email, name: typeof user.name === "string" ? user.name : user.email, role: user.role };
  } catch {
    return null;
  }
});
