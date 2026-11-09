import "server-only";

import { headers } from "next/headers";
import { isIP } from "node:net";

/**
 * Admin sunucusu giriş/şifre isteklerini API'ye kendisi iletir; böylece tüm
 * kullanıcılar API'ye tek IP'den geliyormuş gibi görünür ve bir saldırgan
 * herkesi hız sınırına takabilir. Gerçek ziyaretçi IP'sini, API'nin yalnızca
 * doğru gizli anahtarla güvendiği X-Client-IP başlığıyla iletiriz.
 *
 * Güvenlik: x-forwarded-for'u önündeki reverse proxy (Caddy) üzerine yazar;
 * proxy olmadan doğrudan yayına açmayın.
 */
export async function clientIpHeaders(): Promise<Record<string, string>> {
  const secret = process.env.WEB_API_SECRET;
  if (!secret) return {};
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim();
  return ip && isIP(ip) ? { "X-Web-Secret": secret, "X-Client-IP": ip } : {};
}
