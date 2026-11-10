"use server";

import { z } from "zod";

import { invalid, sendToApi, type ActionResult } from "@/lib/admin/send";
import { adminFetch, readApiError } from "@/lib/api";
import { emptyToNull } from "@/lib/validations/common";
import {
  categorySchema,
  productSchema,
  toPrice,
  type CategoryFormValues,
  type ProductFormValues,
} from "@/lib/validations/shop.schema";

const isUuid = (v: unknown): v is string => z.uuid().safeParse(v).success;
const idList = z.array(z.uuid()).max(200);

// ───── Kategoriler ─────

function categoryPayload(v: CategoryFormValues) {
  return {
    name: v.name,
    slug: v.slug,
    description: emptyToNull(v.description),
    image: emptyToNull(v.image),
    isActive: v.isActive,
    metaTitle: emptyToNull(v.metaTitle),
    metaDescription: emptyToNull(v.metaDescription),
  };
}

export async function createCategoryAction(values: CategoryFormValues): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(values);
  if (!parsed.success) return invalid();
  return sendToApi("/admin/shop/categories", "POST", categoryPayload(parsed.data), "Kategori oluşturulamadı.", "/shop/categories");
}

export async function updateCategoryAction(id: string, values: CategoryFormValues): Promise<ActionResult> {
  if (!isUuid(id)) return invalid("Geçersiz kategori.");
  const parsed = categorySchema.safeParse(values);
  if (!parsed.success) return invalid();
  return sendToApi(`/admin/shop/categories/${id}`, "PATCH", categoryPayload(parsed.data), "Kategori güncellenemedi.", "/shop/categories");
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return invalid("Geçersiz kategori.");
  return sendToApi(`/admin/shop/categories/${id}`, "DELETE", undefined, "Kategori silinemedi.", "/shop/categories");
}

export async function reorderCategoriesAction(ids: string[]): Promise<ActionResult> {
  const parsed = idList.safeParse(ids);
  if (!parsed.success) return invalid();
  return sendToApi("/admin/shop/categories/reorder", "PATCH", { ids: parsed.data }, "Sıralama kaydedilemedi.", "/shop/categories");
}

// ───── Ürünler ─────

function productPayload(v: ProductFormValues) {
  return {
    name: v.name,
    slug: v.slug,
    summary: emptyToNull(v.summary),
    description: emptyToNull(v.description),
    categoryId: v.categoryId,
    vatRate: Number(v.vatRate),
    isActive: v.isActive,
    featured: v.featured,
    isReturnable: v.isReturnable,
    metaTitle: emptyToNull(v.metaTitle),
    metaDescription: emptyToNull(v.metaDescription),
    variants: v.variants.map((variant) => ({
      ...(variant.id ? { id: variant.id } : {}),
      name: variant.name,
      sku: emptyToNull(variant.sku),
      price: toPrice(variant.price),
      compareAtPrice: variant.compareAtPrice === "" ? null : toPrice(variant.compareAtPrice),
      stock: Number(variant.stock),
      trackStock: variant.trackStock,
      isActive: variant.isActive,
    })),
    images: v.images.map((i) => ({ url: i.url, alt: emptyToNull(i.alt) })),
    tabs: v.tabs,
  };
}

export type CreateProductResult = { success: true; id: string } | { success: false; error: string };

export async function createProductAction(values: ProductFormValues): Promise<CreateProductResult> {
  const parsed = productSchema.safeParse(values);
  if (!parsed.success) return { success: false, error: "Form bilgilerini kontrol edin." };
  try {
    const response = await adminFetch("/admin/shop/products", {
      method: "POST",
      body: JSON.stringify(productPayload(parsed.data)),
    });
    if (!response.ok) return { success: false, error: await readApiError(response, "Ürün oluşturulamadı.") };
    const data = (await response.json()) as { id?: unknown };
    if (!isUuid(data.id)) return { success: false, error: "Ürün oluşturuldu ama yanıt okunamadı." };
    return { success: true, id: data.id };
  } catch {
    return { success: false, error: "API sunucusuna bağlanılamadı." };
  }
}

export async function updateProductAction(id: string, values: ProductFormValues): Promise<ActionResult> {
  if (!isUuid(id)) return invalid("Geçersiz ürün.");
  const parsed = productSchema.safeParse(values);
  if (!parsed.success) return invalid();
  return sendToApi(`/admin/shop/products/${id}`, "PATCH", productPayload(parsed.data), "Ürün güncellenemedi.", "/shop/products");
}

export async function setProductActiveAction(id: string, isActive: boolean): Promise<ActionResult> {
  if (!isUuid(id) || typeof isActive !== "boolean") return invalid();
  return sendToApi(`/admin/shop/products/${id}`, "PATCH", { isActive }, "Ürün güncellenemedi.", "/shop/products");
}

export async function deleteProductAction(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return invalid("Geçersiz ürün.");
  return sendToApi(`/admin/shop/products/${id}`, "DELETE", undefined, "Ürün silinemedi.", "/shop/products");
}
