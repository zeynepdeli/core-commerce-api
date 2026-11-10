"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { isAdminRole } from "@/lib/auth";
import { clientIpHeaders } from "@/lib/client-ip-headers";
import { ACCESS_COOKIE, REFRESH_COOKIE, cookieOptions, isTokenPair, sessionCookies } from "@/lib/session-cookies";

export type LoginResult = { success: boolean; error?: string; twoFactor?: boolean };

/** Şifre doğru, kod bekleniyor: giriş anahtarı tarayıcı JS'ine verilmez (httpOnly, 5 dk) */
const CHALLENGE_COOKIE = "admin_2fa";

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
    const challenge = data as { twoFactorRequired?: unknown; challengeToken?: unknown };
    if (challenge.twoFactorRequired === true && typeof challenge.challengeToken === "string" && /^[A-Za-z0-9_-]{43}$/.test(challenge.challengeToken)) {
      (await cookies()).set(CHALLENGE_COOKIE, challenge.challengeToken, { ...cookieOptions(300) });
      return { success: true, twoFactor: true };
    }
    return finishLogin(api, data);
  } catch {
    return { success: false, error: "Sunucu bağlantısında bir sorun oluştu." };
  }
}

/** Girişin 2. adımı: kimlik doğrulayıcı uygulamadaki kod veya yedek kod */
export async function verifyTwoFactorLogin(code: string): Promise<LoginResult> {
  const api = apiUrl();
  if (!api) return { success: false, error: "API bağlantısı yapılandırılmamış." };
  const store = await cookies();
  const challengeToken = store.get(CHALLENGE_COOKIE)?.value;
  if (!challengeToken) return { success: false, error: "Doğrulama süresi doldu. Lütfen yeniden giriş yapın." };
  if (typeof code !== "string" || !/^[0-9A-Za-z -]{6,20}$/.test(code.trim())) return { success: false, error: "Doğrulama kodu hatalı." };

  try {
    const response = await fetch(`${api}/auth/2fa`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await clientIpHeaders()) },
      body: JSON.stringify({ challengeToken, code: code.trim() }),
      cache: "no-store",
      redirect: "error",
    });
    if (response.status === 429) return { success: false, error: "Çok fazla deneme yapıldı. Lütfen bir dakika sonra tekrar deneyin." };
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: unknown };
      const message = typeof body.message === "string" ? body.message : "Doğrulama kodu hatalı.";
      if (message.includes("yeniden giriş")) store.delete(CHALLENGE_COOKIE);
      return { success: false, error: message.slice(0, 200) };
    }
    store.delete(CHALLENGE_COOKIE);
    return finishLogin(api, await response.json());
  } catch {
    return { success: false, error: "Sunucu bağlantısında bir sorun oluştu." };
  }
}

async function finishLogin(api: string, data: unknown): Promise<LoginResult> {
  try {
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
