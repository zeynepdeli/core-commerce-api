import "./zod-locale";
import { z } from "zod";

import { priceText } from "./shop.schema";

const optionalPrice = z.union([priceText, z.literal("")]);

export const shippingSchema = z
  .object({
    shippingFee: priceText,
    freeShippingThreshold: optionalPrice,
    minOrderAmount: optionalPrice,
  })
  .refine((v) => v.freeShippingThreshold === "" || Number(v.freeShippingThreshold.replace(",", ".")) > 0, {
    path: ["freeShippingThreshold"],
    message: "Eşik 0 olamaz; her zaman ücretsiz kargo için kargo ücretini 0 yapın.",
  });
export type ShippingFormValues = z.infer<typeof shippingSchema>;

export const COUPON_TYPES = ["PERCENT", "FIXED", "FREE_SHIPPING"] as const;
export const COUPON_TYPE_LABEL = { PERCENT: "Yüzde indirim", FIXED: "Sabit tutar indirim", FREE_SHIPPING: "Kargo bedava" } as const;

const intText = z.union([z.string().trim().regex(/^\d{1,7}$/, "Pozitif bir tam sayı girin."), z.literal("")]);

export const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .transform((v) => v.replace(/[ıİi]/g, "I").toUpperCase())
      .pipe(z.string().regex(/^[A-Z0-9_-]{3,32}$/, "3–32 karakter; yalnızca harf, rakam, - ve _.")),
    type: z.enum(COUPON_TYPES),
    value: z.union([priceText, z.literal("")]),
    maxDiscount: z.union([priceText, z.literal("")]),
    minSubtotal: z.union([priceText, z.literal("")]),
    startsAt: z.string(),
    endsAt: z.string(),
    usageLimit: intText,
    perUserLimit: intText,
    isActive: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const value = Number(v.value.replace(",", ".") || "0");
    if (v.type === "PERCENT" && (value <= 0 || value > 100)) ctx.addIssue({ code: "custom", path: ["value"], message: "Yüzde 1 ile 100 arasında olmalı." });
    if (v.type === "FIXED" && value <= 0) ctx.addIssue({ code: "custom", path: ["value"], message: "İndirim tutarını girin." });
    if (v.startsAt && v.endsAt && v.endsAt <= v.startsAt) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "Bitiş başlangıçtan sonra olmalı." });
  });
export type CouponFormValues = z.input<typeof couponSchema>;

export const couponDefaults: CouponFormValues = {
  code: "",
  type: "PERCENT",
  value: "",
  maxDiscount: "",
  minSubtotal: "",
  startsAt: "",
  endsAt: "",
  usageLimit: "",
  perUserLimit: "",
  isActive: true,
};
