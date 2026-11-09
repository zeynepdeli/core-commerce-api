"use server";

import { z } from "zod";

import { invalid, sendToApi, type ActionResult } from "@/lib/admin/send";

const schema = z.object({
  status: z.enum(["PENDING", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"]),
  note: z.string().trim().max(500).optional(),
  shippingCarrier: z.string().trim().max(60).regex(/^[^\u0000-\u001f\u007f]*$/).optional(),
  trackingNumber: z.string().trim().max(60).regex(/^[A-Za-z0-9-]*$/, "Takip numarası yalnızca harf, rakam ve tire içerebilir.").optional(),
});

export async function updateOrderStatusAction(id: string, values: z.input<typeof schema>): Promise<ActionResult> {
  const parsed = schema.safeParse(values);
  if (!z.uuid().safeParse(id).success || !parsed.success) return invalid(parsed.error?.issues[0]?.message);
  const v = parsed.data;
  return sendToApi(
    `/admin/orders/${id}/status`,
    "PATCH",
    {
      status: v.status,
      ...(v.note ? { note: v.note } : {}),
      ...(v.shippingCarrier ? { shippingCarrier: v.shippingCarrier } : {}),
      ...(v.trackingNumber ? { trackingNumber: v.trackingNumber } : {}),
    },
    "Durum güncellenemedi.",
    `/orders/${id}`,
  );
}
