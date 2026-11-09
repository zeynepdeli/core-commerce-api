"use server";

import { z } from "zod";

import { clientIpHeaders } from "@/lib/client-ip-headers";

type Result = { success: true; message?: string } | { success: false; error: string };

async function post(path: string, body: unknown): Promise<Response | null> {
  const apiUrl = process.env.API_URL?.replace(/\/$/, "");
  if (!apiUrl) return null;
  const extra = await clientIpHeaders();
  return fetch(`${apiUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extra },
    body: JSON.stringify(body),
    cache: "no-store",
    redirect: "error",
  }).catch(() => null);
}

export async function requestPasswordResetAction(email: string): Promise<Result> {
  const parsed = z.email().max(254).safeParse(email.trim());
  if (!parsed.success) return { success: false, error: "Geçerli bir e-posta girin." };
  const response = await post("/auth/forgot-password", { email: parsed.data });
  if (!response) return { success: false, error: "Sunucuya ulaşılamadı." };
  if (response.status === 429) return { success: false, error: "Çok fazla deneme. Biraz sonra tekrar deneyin." };
  // Kayıtlı olsun olmasın aynı mesaj (e-posta tahmin edilemesin)
  return { success: true, message: "Bu e-posta kayıtlıysa şifre sıfırlama bağlantısı gönderildi. Gelen kutunuzu (ve spam klasörünü) kontrol edin." };
}

const resetSchema = z
  .object({
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    newPassword: z
      .string()
      .min(12, "Yeni şifre en az 12 karakter olmalı.")
      .max(128)
      .regex(/[a-zçğıöşü]/, "En az bir küçük harf içermeli.")
      .regex(/[A-ZÇĞİÖŞÜ]/, "En az bir büyük harf içermeli.")
      .regex(/[0-9]/, "En az bir rakam içermeli."),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Şifreler eşleşmiyor." });

export async function resetPasswordAction(values: unknown): Promise<Result> {
  const parsed = resetSchema.safeParse(values);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Bağlantı geçersiz." };
  const response = await post("/auth/reset-password", { token: parsed.data.token, password: parsed.data.newPassword });
  if (!response) return { success: false, error: "Sunucuya ulaşılamadı." };
  if (response.status === 429) return { success: false, error: "Çok fazla deneme. Biraz sonra tekrar deneyin." };
  if (!response.ok) return { success: false, error: "Bağlantı geçersiz veya süresi dolmuş. Yeniden isteyin." };
  return { success: true };
}
