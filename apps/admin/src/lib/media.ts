import "server-only";

import { adminFetch } from "@/lib/api";

export type MediaFile = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  url: string;
  alt: string | null;
  createdAt: string;
  /** Sitede herhangi bir yerde kullanılıyor mu? (API hesaplar) */
  inUse: boolean;
};

export type MediaPage = { items: MediaFile[]; total: number; page: number; pages: number };

export async function getAdminMedia(page = 1): Promise<MediaPage> {
  const response = await adminFetch(`/admin/media?page=${Math.max(1, Math.min(page, 10_000))}`);
  if (!response.ok) throw new Error(`Medya yüklenemedi (HTTP ${response.status}).`);
  return (await response.json()) as MediaPage;
}
