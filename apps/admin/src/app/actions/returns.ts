"use server";

import { z } from "zod";

import { invalid, sendToApi, type ActionResult } from "@/lib/admin/send";

const id = z.uuid();

export async function decideReturnAction(returnId: string, decision: "approve" | "reject", note: string): Promise<ActionResult> {
  const text = z.string().trim().max(1000).safeParse(note);
  if (!id.safeParse(returnId).success || !["approve", "reject"].includes(decision) || !text.success) return invalid();
  if (decision === "reject" && !text.data) return invalid("Ret gerekçesi yazın (müşteriye gönderilir).");
  return sendToApi(`/admin/returns/${returnId}/decision`, "PATCH", { decision, ...(text.data ? { note: text.data } : {}) }, "Talep güncellenemedi.", `/returns/${returnId}`);
}

export async function receiveReturnAction(returnId: string, restock: boolean): Promise<ActionResult> {
  if (!id.safeParse(returnId).success || typeof restock !== "boolean") return invalid();
  return sendToApi(`/admin/returns/${returnId}/receive`, "POST", { restock }, "Talep güncellenemedi.", `/returns/${returnId}`);
}

export async function refundReturnAction(returnId: string, manual: boolean): Promise<ActionResult> {
  if (!id.safeParse(returnId).success || typeof manual !== "boolean") return invalid();
  return sendToApi(`/admin/returns/${returnId}/refund`, "POST", { manual }, "İade yapılamadı.", `/returns/${returnId}`);
}

export async function retryOrderRefundAction(orderId: string): Promise<ActionResult> {
  if (!id.safeParse(orderId).success) return invalid();
  return sendToApi(`/admin/orders/${orderId}/refund`, "POST", {}, "İade yapılamadı.", `/orders/${orderId}`);
}
