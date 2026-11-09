"use server";

import { z } from "zod";

import { invalid, sendToApi, type ActionResult } from "@/lib/admin/send";

const schema = z.object({
  abandonedCartEnabled: z.boolean(),
  abandonedCartDelayHours: z.number().int().min(1, "1–72 saat").max(72, "1–72 saat"),
  productFeedEnabled: z.boolean(),
  feedBrand: z.string().trim().max(70).regex(/^[^\u0000-\u001f\u007f]*$/),
});

export async function saveMarketingSettingsAction(values: z.input<typeof schema>): Promise<ActionResult> {
  const parsed = schema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);
  const v = parsed.data;
  const result = await sendToApi(
    "/admin/store-settings",
    "PUT",
    { abandonedCartEnabled: v.abandonedCartEnabled, abandonedCartDelayHours: v.abandonedCartDelayHours, productFeedEnabled: v.productFeedEnabled, feedBrand: v.feedBrand || null },
    "Ayarlar kaydedilemedi.",
    "/marketing",
  );
  // Akış önbelleği hemen yenilensin
  if (result.success) await sendToApi("/admin/marketing/feed/refresh", "POST", undefined, "", "/marketing");
  return result;
}

export async function runMarketingJobsAction(): Promise<ActionResult> {
  return sendToApi("/admin/marketing/run", "POST", undefined, "Çalıştırılamadı.", "/marketing");
}
