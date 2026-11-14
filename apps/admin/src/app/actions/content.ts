"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { adminFetch, readApiError } from "@/lib/api";
import { invalid, sendToApi, type ActionResult } from "@/lib/admin/send";

const id = z.uuid();
const ids = z.array(z.uuid()).max(100);
/** Serbest nesne: biçim kontrolü API'de (sınıf bazlı, katı doğrulama) yapılır */
const payload = z.record(z.string(), z.unknown());

export async function saveSiteAction(values: unknown): Promise<ActionResult> {
  const v = payload.safeParse(values);
  if (!v.success) return invalid();
  return sendToApi("/admin/content/site", "PUT", v.data, "Görünüm kaydedilemedi.", "/content/theme");
}

export async function saveFooterAction(values: unknown): Promise<ActionResult> {
  const v = payload.safeParse(values);
  if (!v.success) return invalid();
  return sendToApi("/admin/content/footer", "PUT", v.data, "Footer kaydedilemedi.", "/content/footer");
}

// ───── Ana sayfa bölümleri ─────

export async function saveBlockAction(blockId: string | null, values: unknown): Promise<ActionResult> {
  const v = payload.safeParse(values);
  if (!v.success || (blockId !== null && !id.safeParse(blockId).success)) return invalid();
  if (blockId) return sendToApi(`/admin/content/home/${blockId}`, "PUT", v.data, "Bölüm kaydedilemedi.", "/content/home");
  const response = await adminFetch("/admin/content/home", { method: "POST", body: JSON.stringify(v.data) }).catch(() => null);
  if (!response) return invalid("API sunucusuna bağlanılamadı.");
  if (!response.ok) return { success: false, error: await readApiError(response, "Bölüm eklenemedi.") };
  redirect("/content/home");
}

export async function setBlockActiveAction(blockId: string, isActive: boolean): Promise<ActionResult> {
  if (!id.safeParse(blockId).success || typeof isActive !== "boolean") return invalid();
  return sendToApi(`/admin/content/home/${blockId}/active`, "PATCH", { isActive }, "Güncellenemedi.", "/content/home");
}

export async function deleteBlockAction(blockId: string): Promise<ActionResult> {
  if (!id.safeParse(blockId).success) return invalid();
  return sendToApi(`/admin/content/home/${blockId}`, "DELETE", undefined, "Silinemedi.", "/content/home");
}

export async function reorderBlocksAction(list: string[]): Promise<ActionResult> {
  const v = ids.safeParse(list);
  if (!v.success) return invalid();
  return sendToApi("/admin/content/home/reorder", "PUT", { ids: v.data }, "Sıralanamadı.", "/content/home");
}

/** Ürün seçici: ada göre arama */
export async function searchProductsAction(q: string): Promise<{ id: string; name: string }[]> {
  const text = z.string().trim().max(100).safeParse(q);
  if (!text.success) return [];
  const response = await adminFetch(`/admin/shop/products?${new URLSearchParams({ q: text.data, limit: "20" })}`).catch(() => null);
  if (!response?.ok) return [];
  const data = (await response.json()) as { items: { id: string; name: string }[] };
  return data.items.map(({ id: pid, name }) => ({ id: pid, name }));
}

// ───── Sayfalar ─────

export async function savePageAction(pageId: string | null, values: unknown): Promise<ActionResult> {
  const v = payload.safeParse(values);
  if (!v.success || (pageId !== null && !id.safeParse(pageId).success)) return invalid();
  if (pageId) return sendToApi(`/admin/content/pages/${pageId}`, "PUT", v.data, "Sayfa kaydedilemedi.", "/content/pages");
  const response = await adminFetch("/admin/content/pages", { method: "POST", body: JSON.stringify(v.data) }).catch(() => null);
  if (!response) return invalid("API sunucusuna bağlanılamadı.");
  if (!response.ok) return { success: false, error: await readApiError(response, "Sayfa oluşturulamadı.") };
  redirect("/content/pages");
}

export async function deletePageAction(pageId: string): Promise<ActionResult> {
  if (!id.safeParse(pageId).success) return invalid();
  return sendToApi(`/admin/content/pages/${pageId}`, "DELETE", undefined, "Silinemedi.", "/content/pages");
}

export async function reorderPagesAction(list: string[]): Promise<ActionResult> {
  const v = ids.safeParse(list);
  if (!v.success) return invalid();
  return sendToApi("/admin/content/pages/reorder", "PUT", { ids: v.data }, "Sıralanamadı.", "/content/pages");
}

// ───── S.S.S. ─────

export async function saveFaqAction(faqId: string | null, values: unknown): Promise<ActionResult> {
  const v = payload.safeParse(values);
  if (!v.success || (faqId !== null && !id.safeParse(faqId).success)) return invalid();
  return faqId
    ? sendToApi(`/admin/content/faq/${faqId}`, "PUT", v.data, "Kaydedilemedi.", "/content/faq")
    : sendToApi("/admin/content/faq", "POST", v.data, "Eklenemedi.", "/content/faq");
}

export async function deleteFaqAction(faqId: string): Promise<ActionResult> {
  if (!id.safeParse(faqId).success) return invalid();
  return sendToApi(`/admin/content/faq/${faqId}`, "DELETE", undefined, "Silinemedi.", "/content/faq");
}

export async function reorderFaqAction(list: string[]): Promise<ActionResult> {
  const v = ids.safeParse(list);
  if (!v.success) return invalid();
  return sendToApi("/admin/content/faq/reorder", "PUT", { ids: v.data }, "Sıralanamadı.", "/content/faq");
}
