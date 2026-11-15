import { NextResponse, type NextRequest } from "next/server";

import { ApiError, adminFetch, readApiError } from "@/lib/api";
import { MAX_VIDEO_BYTES } from "@/lib/validations/media";

// Yerel / Cloudinary video adresi (API yanıtına da körü körüne güvenilmez)
const VIDEO_URL =
  /^(\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp4|webm)|https:\/\/res\.cloudinary\.com\/[a-z0-9_-]+\/video\/upload\/[A-Za-z0-9_./-]+)$/i;

/** Çok parçalı formun (dosya adı vb.) payı */
const FORM_OVERHEAD = 64 * 1024;

const fail = (status: number, error: string) => NextResponse.json({ success: false, error }, { status });

/**
 * Video yükleme: tarayıcı → admin → API.
 * Server Action yerine Route Handler: Server Action'ların gövde sınırını (6 MB) tüm eylemler için
 * 25 MB'a çıkarmak gerekirdi. Burada gövde BELLEKTE BİRİKTİRİLMEDEN API'ye akıtılır.
 * Güvenlik (Server Action'ların kendiliğinden yaptıkları burada elle):
 * - Origin denetimi (CSRF): yalnızca admin'in kendi sayfalarından
 * - Oturum: adminFetch oturum çerezi yoksa 401; yetkiyi asıl API denetler (ADMIN rolü)
 * - Boyut: Content-Length bildirilmeli ve sınırın altında olmalı (API de ayrıca sınırlar)
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) return fail(403, "Geçersiz istek kaynağı.");

  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) return fail(400, "Geçersiz istek.");
  const length = Number(request.headers.get("content-length"));
  if (!Number.isFinite(length) || length <= 0) return fail(411, "Dosya boyutu bildirilmedi.");
  if (length > MAX_VIDEO_BYTES + FORM_OVERHEAD) return fail(413, "Video en fazla 25 MB olabilir.");
  if (!request.body) return fail(400, "Yüklenecek video bulunamadı.");

  try {
    const response = await adminFetch("/admin/media/upload-video", {
      method: "POST",
      body: request.body,
      headers: { "Content-Type": request.headers.get("content-type")!, "Content-Length": String(length) },
      // Akış gövdesi için Node fetch'in istediği ayar
      ...({ duplex: "half" } as object),
    });
    if (response.status === 413) return fail(413, "Video en fazla 25 MB olabilir.");
    if (!response.ok) return fail(response.status === 400 ? 400 : 502, await readApiError(response, "Video yüklenemedi."));

    const media = (await response.json()) as { url?: unknown };
    if (typeof media.url !== "string" || !VIDEO_URL.test(media.url)) return fail(502, "Sunucudan beklenmeyen yanıt alındı.");
    return NextResponse.json({ success: true, url: media.url });
  } catch (error) {
    return fail(error instanceof ApiError ? error.status : 500, error instanceof ApiError ? error.message : "Beklenmeyen bir hata oluştu.");
  }
}
