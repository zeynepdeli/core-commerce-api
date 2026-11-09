"use server";

import { cookies } from "next/headers";
import { ApiError, adminFetch, readApiError } from "@/lib/api";
import { passwordSchema } from "@/lib/validations/account.schema";
import { isTokenPair, sessionCookies } from "@/lib/session-cookies";

/**
 * Şifre değiştirme. Başarılı olunca API eski oturumları geçersiz kılar
 * ve yeni bir oturum anahtarı döner; çerez onunla yenilenir.
 */
export async function changePasswordAction(
  values: unknown,
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = passwordSchema.safeParse(values);
  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Bilgileri kontrol edin.",
    };

  try {
    const response = await adminFetch("/account/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
      }),
    });
    if (response.status === 429) {
      return {
        success: false,
        error: "Çok fazla deneme yapıldı. Bir dakika sonra tekrar deneyin.",
      };
    }
    if (!response.ok) {
      return {
        success: false,
        error: await readApiError(response, "Şifre değiştirilemedi."),
      };
    }

    const data: unknown = await response.json();
    if (!isTokenPair(data))
      return { success: false, error: "Şifre değiştirilemedi." };

    const store = await cookies();
    for (const c of sessionCookies(data)) store.set(c.name, c.value, c.options);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof ApiError
          ? error.message
          : "Beklenmeyen bir hata oluştu.",
    };
  }
}
