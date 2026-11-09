"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { isAdminRole } from "@/lib/auth";
import { clientIpHeaders } from "@/lib/client-ip-headers";
import { ACCESS_COOKIE, REFRESH_COOKIE, isTokenPair, sessionCookies } from "@/lib/session-cookies";

export type LoginResult = { success: boolean; error?: string };

const apiUrl = () => process.env.API_URL?.replace(/\/$/, "");

export async function loginAdmin(email: string, password: string): Promise<LoginResult> {
  const api = apiUrl();
  if (!api) return { success: false, error: "API bağlantısı yapılandırılmamış." };
  if (typeof email !== "string" || typeof password !== "string" || email.length > 254 || password.length > 128) {
    return { success: false, error: "E-posta veya şifre hatalı." };
  }

  try {
    const response = await fetch(`${api}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await clientIpHeaders()) },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
      redirect: "error",
    });

    if (response.status === 429) {
      return { success: false, error: "Çok fazla deneme yapıldı. Lütfen bir dakika sonra tekrar deneyin." };
    }
    if (response.status === 403) {
      return { success: false, error: "Hesabınız kullanıma kapatılmış." };
    }
    if (!response.ok) return { success: false, error: "E-posta veya şifre hatalı." };

    const data = (await response.json()) as unknown;
    if (!isTokenPair(data)) return { success: false, error: "Sunucu beklenmeyen bir yanıt verdi." };

    // Müşteri hesabıyla panele girilemez; açılan oturum hemen kapatılır
    const role = (data as { user?: { role?: unknown } }).user?.role;
    if (!isAdminRole(role)) {
      await fetch(`${api}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: data.refreshToken }),
        cache: "no-store",
      }).catch(() => undefined);
      return { success: false, error: "Bu alana erişim yetkiniz bulunmuyor." };
    }

    const store = await cookies();
    for (const c of sessionCookies(data)) store.set(c.name, c.value, c.options);
    return { success: true };
  } catch {
    return { success: false, error: "Sunucu bağlantısında bir sorun oluştu." };
  }
}

export async function logoutAdmin(): Promise<void> {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  const api = apiUrl();

  // Sunucudaki oturumu da kapat (çerez çalınmış olsa bile işe yaramaz)
  if (refreshToken && api) {
    await fetch(`${api}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    }).catch(() => undefined);
  }

  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
  redirect("/login");
}
