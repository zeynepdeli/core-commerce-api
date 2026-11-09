import "./zod-locale";
import { z } from "zod";

import { imageUrlSchema } from "./common";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ONE_LINE = /^[^\u0000-\u001f\u007f]*$/;
const PRICE = /^\d{1,8}(?:[.,]\d{1,2})?$/;

const oneLine = (max: number) => z.string().trim().max(max).regex(ONE_LINE, "Bu alan tek satır olmalıdır.");
const slug = z
  .string()
  .trim()
  .min(1, "Adres zorunludur.")
  .max(150)
  .regex(SLUG, "Yalnızca küçük harf, rakam ve tire kullanın (ör. tulum-peyniri).");

/** "1.249,90" değil, "1249,90" veya "1249.90" biçimi */
export const priceText = z
  .string()
  .trim()
  .regex(PRICE, "Fiyatı 1249,90 biçiminde girin (en fazla 2 kuruş basamağı).");

export const toPrice = (value: string) => Number(value.trim().replace(",", "."));

export const categorySchema = z.object({
  name: oneLine(120).min(1, "Kategori adı zorunludur."),
  slug,
  description: z.string().trim().max(2000),
  image: imageUrlSchema,
  isActive: z.boolean(),
  metaTitle: oneLine(150),
  metaDescription: z.string().trim().max(300),
});
export type CategoryFormValues = z.infer<typeof categorySchema>;

export const categoryDefaultValues: CategoryFormValues = {
  name: "",
  slug: "",
  description: "",
  image: "",
  isActive: true,
  metaTitle: "",
  metaDescription: "",
};

export const MAX_PRODUCT_IMAGES = 12;
export const MAX_PRODUCT_TABS = 10;

export const MAX_PRODUCT_VARIANTS = 30;
export const VAT_RATES = ["0", "1", "10", "20"] as const;

export const variantSchema = z
  .object({
    /** Kayıtlı varyantın kimliği; yeni satırda boş */
    id: z.union([z.uuid(), z.literal("")]),
    name: oneLine(60).min(1, "Seçenek adı zorunludur (ör. 500 g)."),
    sku: z
      .string()
      .trim()
      .max(64)
      .regex(/^[A-Za-z0-9._-]*$/, "Stok kodu yalnızca harf, rakam, nokta, tire ve alt çizgi içerebilir."),
    price: priceText,
    compareAtPrice: z.union([priceText, z.literal("")]),
    stock: z.string().trim().regex(/^\d{1,7}$/, "Stok 0 veya pozitif bir tam sayı olmalıdır."),
    trackStock: z.boolean(),
    isActive: z.boolean(),
  })
  .refine((v) => v.compareAtPrice === "" || toPrice(v.compareAtPrice) > toPrice(v.price), {
    path: ["compareAtPrice"],
    message: "Eski fiyat, satış fiyatından yüksek olmalıdır.",
  });
export type VariantFormValues = z.infer<typeof variantSchema>;

export const emptyVariant = (name = ""): VariantFormValues => ({
  id: "",
  name,
  sku: "",
  price: "",
  compareAtPrice: "",
  stock: "0",
  trackStock: true,
  isActive: true,
});

export const productSchema = z
  .object({
    name: oneLine(200).min(1, "Ürün adı zorunludur."),
    slug,
    summary: z.string().trim().max(500),
    description: z.string().trim().max(20000),
    categoryId: z.uuid("Kategori seçin."),
    vatRate: z.enum(VAT_RATES),
    isActive: z.boolean(),
    featured: z.boolean(),
    metaTitle: oneLine(150),
    metaDescription: z.string().trim().max(300),
    variants: z
      .array(variantSchema)
      .min(1, "En az bir seçenek (fiyat/stok) girilmelidir.")
      .max(MAX_PRODUCT_VARIANTS, `En fazla ${MAX_PRODUCT_VARIANTS} seçenek eklenebilir.`),
    images: z
      .array(z.object({ url: imageUrlSchema.refine((v) => v !== "", "Görsel seçin."), alt: oneLine(200) }))
      .max(MAX_PRODUCT_IMAGES, `En fazla ${MAX_PRODUCT_IMAGES} görsel eklenebilir.`),
    tabs: z
      .array(
        z.object({
          title: oneLine(80).min(1, "Sekme başlığı zorunludur."),
          body: z.string().trim().min(1, "Sekme içeriği zorunludur.").max(10000),
        }),
      )
      .max(MAX_PRODUCT_TABS, `En fazla ${MAX_PRODUCT_TABS} sekme eklenebilir.`),
  })
  .superRefine((v, ctx) => {
    const names = new Map<string, number>();
    v.variants.forEach((variant, index) => {
      const key = variant.name.trim().toLocaleLowerCase("tr");
      if (names.has(key)) ctx.addIssue({ code: "custom", path: ["variants", index, "name"], message: "Aynı adlı iki seçenek olamaz." });
      names.set(key, index);
    });
    if (!v.variants.some((variant) => variant.isActive)) {
      ctx.addIssue({ code: "custom", path: ["variants"], message: "En az bir seçenek satışta olmalıdır." });
    }
  });
export type ProductFormValues = z.infer<typeof productSchema>;

export const productDefaultValues: ProductFormValues = {
  name: "",
  slug: "",
  summary: "",
  description: "",
  categoryId: "",
  vatRate: "20",
  isActive: true,
  featured: false,
  metaTitle: "",
  metaDescription: "",
  variants: [emptyVariant("Adet")],
  images: [],
  tabs: [],
};
