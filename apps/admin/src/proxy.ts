import { NextResponse, type NextRequest } from "next/server";

import { ACCESS_COOKIE, REFRESH_COOKIE, isTokenPair, sessionCookies } from "@/lib/session-cookies";

/**
 * Kayan oturum: erişim çerezi düştüyse ama yenileme çerezi varsa, istek
 * sayfaya ulaşmadan oturum sessizce yenilenir (refresh token rotation).
 * Ayrıca tüm sayfalara güvenlik başlıkları eklenir.
 */
export async function proxy(request: NextRequest) {
  const hasAccess = request.cookies.has(ACCESS_COOKIE);
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const apiUrl = process.env.API_URL;

  if (hasAccess || !refreshToken || !apiUrl) return NextResponse.next();
  if (!/^[A-Za-z0-9_-]{43}$/.test(refreshToken)) {
    const res = NextResponse.next();
    res.cookies.delete(REFRESH_COOKIE);
    return res;
  }

  try {
    const response = await fetch(`${apiUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    const data: unknown = response.ok ? await response.json() : null;

    if (!isTokenPair(data)) {
      // Geçersiz/çalınmış/süresi dolmuş: çerezi temizle, sayfa girişe yönlendirir
      const res = NextResponse.next();
      res.cookies.delete(REFRESH_COOKIE);
      return res;
    }

    // Bu isteği işleyen sayfa da yeni anahtarı görsün
    request.cookies.set(ACCESS_COOKIE, data.accessToken);
    request.cookies.set(REFRESH_COOKIE, data.refreshToken);
    const res = NextResponse.next({ request: { headers: request.headers } });
    for (const c of sessionCookies(data)) res.cookies.set(c.name, c.value, c.options);
    return res;
  } catch {
    // API'ye ulaşılamadı: çerezlere dokunma, bir sonraki istekte tekrar dene
    return NextResponse.next();
  }
}

export const config = {
  // Statik dosyalar, giriş ve şifre sıfırlama sayfaları hariç
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|login|forgot-password|reset-password|.*\\.(?:png|jpg|svg|webp|ico)$).*)",
  ],
};
