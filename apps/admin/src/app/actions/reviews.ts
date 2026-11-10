"use server";

import { z } from "zod";

import { invalid, sendToApi, type ActionResult } from "@/lib/admin/send";

const id = z.uuid();
const text = (max: number) => z.string().trim().max(max).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/);

export async function moderateReviewAction(reviewId: string, status: "APPROVED" | "REJECTED", reason = ""): Promise<ActionResult> {
  const r = text(500).safeParse(reason);
  if (!id.safeParse(reviewId).success || !["APPROVED", "REJECTED"].includes(status) || !r.success) return invalid();
  return sendToApi(`/admin/reviews/${reviewId}`, "PATCH", { status, ...(status === "REJECTED" && r.data ? { rejectReason: r.data } : {}) }, "Güncellenemedi.", "/reviews");
}

export async function replyReviewAction(reviewId: string, reply: string): Promise<ActionResult> {
  const r = text(1000).safeParse(reply);
  if (!id.safeParse(reviewId).success || !r.success) return invalid("Yanıt en fazla 1000 karakter olabilir.");
  return sendToApi(`/admin/reviews/${reviewId}/reply`, "PUT", { reply: r.data }, "Yanıt kaydedilemedi.", "/reviews");
}

export async function deleteReviewAction(reviewId: string): Promise<ActionResult> {
  if (!id.safeParse(reviewId).success) return invalid();
  return sendToApi(`/admin/reviews/${reviewId}`, "DELETE", undefined, "Silinemedi.", "/reviews");
}

export async function setReviewAutoApproveAction(on: boolean): Promise<ActionResult> {
  if (typeof on !== "boolean") return invalid();
  return sendToApi("/admin/store-settings", "PUT", { reviewAutoApprove: on }, "Kaydedilemedi.", "/reviews");
}
