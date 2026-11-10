"use server";

import { z } from "zod";

import { invalid, sendToApi, type ActionResult } from "@/lib/admin/send";

const isUuid = (v: unknown): v is string => z.uuid().safeParse(v).success;

export async function setUserActiveAction(id: string, isActive: boolean): Promise<ActionResult> {
  if (!isUuid(id) || typeof isActive !== "boolean") return invalid();
  return sendToApi(`/admin/users/${id}/active`, "PATCH", { isActive }, "Güncellenemedi.", "/users");
}

export async function unlockUserAction(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return invalid();
  return sendToApi(`/admin/users/${id}/unlock`, "POST", undefined, "Kilit açılamadı.", "/users");
}

const ROLE = z.enum(["CUSTOMER", "ADMIN", "SUPER_ADMIN"]);

/** API ayrıca yalnızca SUPER_ADMIN'e izin verir; burası yalnızca biçimi doğrular */
export async function setUserRoleAction(id: string, role: string): Promise<ActionResult> {
  const parsed = ROLE.safeParse(role);
  if (!isUuid(id) || !parsed.success) return invalid();
  return sendToApi(`/admin/users/${id}/role`, "PATCH", { role: parsed.data }, "Rol değiştirilemedi.", "/users");
}

/** Yalnızca SUPER_ADMIN (API ayrıca denetler) */
export async function resetUserTwoFactorAction(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return invalid();
  return sendToApi(`/admin/users/${id}/two-factor/reset`, "POST", undefined, "Sıfırlanamadı.", "/users");
}
