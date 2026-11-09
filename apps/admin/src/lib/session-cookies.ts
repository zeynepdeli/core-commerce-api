/**
 * Oturum çerezleri (tek yerde tanımlı).
 * - admin_session: kısa ömürlü erişim anahtarı (API'deki süreden 1 dk önce düşer)
 * - admin_refresh: yenileme anahtarı; proxy.ts bununla oturumu sessizce yeniler
 * İkisi de httpOnly (tarayıcı JS'i okuyamaz) + SameSite=Strict (CSRF) +
 * production'da Secure. Token'lar asla tarayıcı koduna verilmez.
 */
export const ACCESS_COOKIE = "admin_session";
export const REFRESH_COOKIE = "admin_refresh";

/** API'nin /auth/login, /auth/refresh, /account/change-password yanıtı */
export type TokenPair = {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
};

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge,
  };
}

export const accessMaxAge = (pair: TokenPair) => Math.max(60, pair.accessTokenExpiresIn - 60);

export const refreshMaxAge = (pair: TokenPair) =>
  Math.max(60, Math.floor((Date.parse(pair.refreshTokenExpiresAt) - Date.now()) / 1000));

export function isTokenPair(value: unknown): value is TokenPair {
  const v = value as Partial<TokenPair> | null;
  return (
    !!v &&
    typeof v.accessToken === "string" &&
    v.accessToken.length < 4096 &&
    typeof v.refreshToken === "string" &&
    /^[A-Za-z0-9_-]{43}$/.test(v.refreshToken) &&
    typeof v.accessTokenExpiresIn === "number" &&
    typeof v.refreshTokenExpiresAt === "string" &&
    !Number.isNaN(Date.parse(v.refreshTokenExpiresAt))
  );
}

/** Çerezleri yazan yer (server action veya proxy) için ortak */
export function sessionCookies(pair: TokenPair) {
  return [
    { name: ACCESS_COOKIE, value: pair.accessToken, options: cookieOptions(accessMaxAge(pair)) },
    { name: REFRESH_COOKIE, value: pair.refreshToken, options: cookieOptions(refreshMaxAge(pair)) },
  ] as const;
}
