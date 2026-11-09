"use server";

import { z } from "zod";

import { invalid, sendToApi, type ActionResult } from "@/lib/admin/send";
import { toPrice } from "@/lib/validations/shop.schema";
import { couponSchema, legalSchema, shippingSchema, storeInfoSchema, type CouponFormValues, type ShippingFormValues } from "@/lib/validations/store.schema";

const money = (v: string) => (v === "" ? null : toPrice(v));
const int = (v: string) => (v === "" ? null : Number(v));
/** "2026-11-20T09:00" (Türkiye saati) → ISO */
const date = (v: string) => (v === "" ? null : new Date(`${v}:00+03:00`).toISOString());

export async function updateShippingAction(values: ShippingFormValues): Promise<ActionResult> {
  const parsed = shippingSchema.safeParse(values);
  if (!parsed.success) return invalid();
  const v = parsed.data;
  return sendToApi(
    "/admin/store-settings",
    "PUT",
    { shippingFee: toPrice(v.shippingFee), freeShippingThreshold: money(v.freeShippingThreshold), minOrderAmount: money(v.minOrderAmount) },
    "Ayarlar kaydedilemedi.",
    "/shop/shipping",
  );
}

function couponPayload(v: z.output<typeof couponSchema>) {
  return {
    value: v.type === "FREE_SHIPPING" ? 0 : toPrice(v.value || "0"),
    maxDiscount: v.type === "PERCENT" ? money(v.maxDiscount) : null,
    minSubtotal: money(v.minSubtotal),
    startsAt: date(v.startsAt),
    endsAt: date(v.endsAt),
    usageLimit: int(v.usageLimit),
    perUserLimit: int(v.perUserLimit),
    isActive: v.isActive,
  };
}

export async function createCouponAction(values: CouponFormValues): Promise<ActionResult> {
  const parsed = couponSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);
  return sendToApi("/admin/coupons", "POST", { code: parsed.data.code, type: parsed.data.type, ...couponPayload(parsed.data) }, "Kupon oluşturulamadı.", "/shop/coupons");
}

export async function updateCouponAction(id: string, values: CouponFormValues): Promise<ActionResult> {
  const parsed = couponSchema.safeParse(values);
  if (!z.uuid().safeParse(id).success || !parsed.success) return invalid(parsed.error?.issues[0]?.message);
  return sendToApi(`/admin/coupons/${id}`, "PATCH", couponPayload(parsed.data), "Kupon güncellenemedi.", "/shop/coupons");
}

export async function deleteCouponAction(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return invalid();
  return sendToApi(`/admin/coupons/${id}`, "DELETE", undefined, "Kupon silinemedi.", "/shop/coupons");
}

const blank = (v: string) => (v.trim() === "" ? null : v.trim());

export async function updateStoreInfoAction(values: z.input<typeof storeInfoSchema>): Promise<ActionResult> {
  const parsed = storeInfoSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);
  const v = parsed.data;
  return sendToApi(
    "/admin/store-settings",
    "PUT",
    {
      sellerName: blank(v.sellerName),
      sellerEmail: blank(v.sellerEmail),
      sellerPhone: blank(v.sellerPhone),
      sellerTaxOffice: blank(v.sellerTaxOffice),
      sellerTaxNumber: blank(v.sellerTaxNumber),
      sellerMersisNo: blank(v.sellerMersisNo),
      sellerAddress: blank(v.sellerAddress),
      paymentTimeoutMinutes: Number(v.paymentTimeoutMinutes),
    },
    "Bilgiler kaydedilemedi.",
    "/shop/store-info",
  );
}

const LEGAL = z.enum(["PRE_INFORMATION", "DISTANCE_SALES", "KVKK_NOTICE"]);

export async function saveLegalAction(type: string, values: z.input<typeof legalSchema>): Promise<ActionResult> {
  const t = LEGAL.safeParse(type);
  const parsed = legalSchema.safeParse(values);
  if (!t.success || !parsed.success) return invalid(parsed.error?.issues[0]?.message);
  return sendToApi(`/admin/legal/${t.data}`, "PUT", parsed.data, "Metin kaydedilemedi.", "/shop/legal");
}
