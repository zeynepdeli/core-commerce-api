"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { z } from "zod";

import { ApiError, adminFetch, readApiError } from "@/lib/api";
import { isTokenPair, sessionCookies } from "@/lib/session-cookies";

type Fail = { success: false; error: string };
const fail = (error: string): Fail => ({ success: false, error });
const code = z.string().trim().regex(/^[0-9A-Za-z -]{6,20}$/, "Doğrulama kodu hatalı.");
const password = z.string().min(1, "Şifrenizi girin.").max(128);

async function post(path: string, body: unknown, fallback: string): Promise<{ ok: true; data: unknown } | Fail> {
  try {
    const response = await adminFetch(path, { method: "POST", body: JSON.stringify(body) });
    if (response.status === 429) return fail("Çok fazla deneme yapıldı. Bir dakika sonra tekrar deneyin.");
    if (!response.ok) return fail(await readApiError(response, fallback));
    return { ok: true, data: await response.json() };
  } catch (error) {
    return fail(error instanceof ApiError ? error.message : "Beklenmeyen bir hata oluştu.");
  }
}

/** 1. adım: şifre doğrulanır, QR kod (SVG, sunucuda üretilir) ve elle giriş anahtarı döner */
export async function startTwoFactorSetupAction(pw: string): Promise<{ success: true; secret: string; qrSvg: string } | Fail> {
  const parsed = password.safeParse(pw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Şifrenizi girin.");
  const r = await post("/account/2fa/setup", { password: parsed.data }, "Kurulum başlatılamadı.");
  if (!("ok" in r)) return r;
  const data = r.data as { secret?: unknown; otpauthUrl?: unknown };
  if (typeof data.secret !== "string" || typeof data.otpauthUrl !== "string" || !data.otpauthUrl.startsWith("otpauth://totp/")) return fail("Kurulum başlatılamadı.");
  const qrSvg = await QRCode.toString(data.otpauthUrl, { type: "svg", errorCorrectionLevel: "M", margin: 1 });
  return { success: true, secret: data.secret, qrSvg };
}

/** 2. adım: kod doğrulanır; diğer oturumlar kapanır, bu cihazın çerezleri yenilenir */
export async function enableTwoFactorAction(value: string): Promise<{ success: true; recoveryCodes: string[] } | Fail> {
  const parsed = code.safeParse(value);
  if (!parsed.success) return fail("Kod 6 haneli olmalı.");
  const r = await post("/account/2fa/enable", { code: parsed.data }, "Kod doğrulanamadı.");
  if (!("ok" in r)) return r;
  const data = r.data as { recoveryCodes?: unknown };
  if (!isTokenPair(data) || !Array.isArray(data.recoveryCodes)) return fail("Sunucu beklenmeyen bir yanıt verdi.");
  const store = await cookies();
  for (const c of sessionCookies(data)) store.set(c.name, c.value, c.options);
  return { success: true, recoveryCodes: data.recoveryCodes.filter((c): c is string => typeof c === "string") };
}

export async function regenerateRecoveryCodesAction(value: string): Promise<{ success: true; recoveryCodes: string[] } | Fail> {
  const parsed = code.safeParse(value);
  if (!parsed.success) return fail("Kod 6 haneli olmalı.");
  const r = await post("/account/2fa/recovery-codes", { code: parsed.data }, "Yedek kodlar oluşturulamadı.");
  if (!("ok" in r)) return r;
  const data = r.data as { recoveryCodes?: unknown };
  if (!Array.isArray(data.recoveryCodes)) return fail("Sunucu beklenmeyen bir yanıt verdi.");
  revalidatePath("/account");
  return { success: true, recoveryCodes: data.recoveryCodes.filter((c): c is string => typeof c === "string") };
}

export async function disableTwoFactorAction(pw: string, value: string): Promise<{ success: true } | Fail> {
  const p = password.safeParse(pw);
  const c = code.safeParse(value);
  if (!p.success || !c.success) return fail("Şifre ve doğrulama kodunu girin.");
  const r = await post("/account/2fa/disable", { password: p.data, code: c.data }, "Kapatılamadı.");
  if (!("ok" in r)) return r;
  revalidatePath("/account");
  return { success: true };
}
