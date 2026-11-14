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

const optionalLine = (max: number) => z.string().trim().max(max).regex(/^[^\u0000-\u001f\u007f]*$/, "Tek satır olmalı.");

export const storeInfoSchema = z.object({
  sellerName: optionalLine(200),
  sellerEmail: z.union([z.email("Geçerli bir e-posta girin."), z.literal("")]),
  sellerPhone: z.string().trim().max(30).regex(/^[0-9 +()-]*$/, "Yalnızca rakam ve + ( ) -"),
  sellerTaxOffice: optionalLine(100),
  sellerTaxNumber: z.string().trim().regex(/^(\d{10,11})?$/, "10 veya 11 haneli olmalı."),
  sellerMersisNo: z.string().trim().regex(/^(\d{16})?$/, "16 haneli olmalı."),
  sellerKepAddress: z.union([z.email("KEP adresi e-posta biçiminde olmalı (ör. unvan@hs01.kep.tr)."), z.literal("")]),
  sellerAddress: z.string().trim().max(500),
  paymentTimeoutMinutes: z.string().trim().regex(/^\d{2,4}$/, "10–1440 arası dakika").refine((v) => Number(v) >= 10 && Number(v) <= 1440, "10–1440 arası dakika"),
  returnWindowDays: z.string().trim().regex(/^\d{2,3}$/, "14–365 arası gün").refine((v) => Number(v) >= 14 && Number(v) <= 365, "Yasal olarak en az 14 gün"),
});

export const legalSchema = z.object({
  title: optionalLine(150).min(2),
  content: z.string().min(20, "Metin çok kısa.").max(60000),
});
