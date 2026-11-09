import "server-only";

import { revalidatePath } from "next/cache";

import { ApiError, adminFetch, readApiError } from "@/lib/api";

export type ActionResult = { success: true } | { success: false; error: string };

/**
 * Server action'lar için ortak API çağrısı:
 * - Hata mesajlarını tek yerde toplar
 * - Başarılı olursa verilen admin yolunu yeniler
 */
export async function sendToApi(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body: unknown,
  fallback: string,
  revalidate: string,
): Promise<ActionResult> {
  try {
    const response = await adminFetch(path, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      return { success: false, error: await readApiError(response, fallback) };
    }

    revalidatePath(revalidate);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof ApiError ? error.message : "Beklenmeyen bir hata oluştu.",
    };
  }
}

export function invalid(message = "Form bilgilerini kontrol edin."): ActionResult {
  return { success: false, error: message };
}
