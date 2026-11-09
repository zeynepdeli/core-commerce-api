import "server-only";

import { cookies } from "next/headers";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Admin token'ı ile NestJS API'ye istek atar.
 * - "server-only": bu dosya tarayıcı paketine ASLA girmez, token sızmaz.
 * - redirect: "error": API bir yönlendirme dönerse token başka bir
 *   adrese gitmesin (SSRF / token sızıntısı koruması).
 * - Yalnızca "/" ile başlayan yollar kabul edilir.
 */
export async function adminFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("Geçersiz API yolu.");
  }

  const apiUrl = process.env.API_URL?.replace(/\/$/, "");
  if (!apiUrl) {
    throw new ApiError(500, "API bağlantısı yapılandırılmamış.");
  }

  const token = (await cookies()).get("admin_session")?.value;
  if (!token) {
    throw new ApiError(
      401,
      "Oturumunuz sona ermiş. Lütfen tekrar giriş yapın.",
    );
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");
  if (typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    return await fetch(`${apiUrl}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      redirect: "error",
    });
  } catch {
    throw new ApiError(503, "API sunucusuna bağlanılamadı.");
  }
}

/** API hata kodlarını kullanıcıya gösterilecek mesaja çevirir. */
export function apiErrorMessage(status: number, fallback: string): string {
  if (status === 400) return "Gönderilen bilgiler geçersiz.";
  if (status === 401)
    return "Oturumunuz sona ermiş. Lütfen tekrar giriş yapın.";
  if (status === 403) return "Bu işlem için yönetici yetkiniz bulunmuyor.";
  if (status === 404) return "Kayıt bulunamadı.";
  if (status === 429) return "Çok fazla istek gönderildi. Biraz bekleyin.";
  return fallback;
}

/**
 * API'nin döndürdüğü hata mesajını okur (400/409: doğrulama ve iş kuralı
 * mesajları — bunlar bizim yazdığımız, kullanıcıya gösterilebilir metinler).
 * 5xx ve diğer durumlarda iç ayrıntı sızmasın diye genel mesaj döner.
 */
export async function readApiError(
  response: Response,
  fallback: string,
): Promise<string> {
  if (response.status === 400 || response.status === 409) {
    try {
      const data = (await response.json()) as { message?: unknown };
      const message = Array.isArray(data.message)
        ? data.message.filter((m) => typeof m === "string").join(" ")
        : data.message;

      if (typeof message === "string" && message.trim()) {
        return message.slice(0, 300);
      }
    } catch {
      // JSON değilse genel mesaja düş
    }
  }

  return apiErrorMessage(response.status, fallback);
}
