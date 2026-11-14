import { notFound } from "next/navigation";
import { LayoutTemplate } from "lucide-react";
import { z } from "zod";

import { AreaShell } from "@/components/areas/AreaShell";
import { BlockEditor } from "@/components/content/BlockEditor";
import { adminFetch } from "@/lib/api";
import { BLOCK_LABEL, getBlock, getContentOptions } from "@/lib/content";
import { getMediaBaseUrl } from "@/lib/media-base-url";
import { getAdminCategories } from "@/lib/shop";

const DEFAULTS: Record<string, Record<string, unknown>> = {
  HERO: { slides: [{ imageUrl: "" }], autoplay: true, intervalSeconds: 5 },
  PRODUCT_LIST: { source: "featured", limit: 8, productIds: [] },
  CATEGORY_GRID: { categoryIds: [] },
  BANNER: { imageUrl: "" },
  TEXT: { body: "" },
  FEATURES: {
    items: [
      { icon: "truck", title: "Hızlı kargo" },
      { icon: "shield", title: "Güvenli ödeme" },
      { icon: "refresh", title: "Kolay iade" },
    ],
  },
};

export default async function BlockPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tur?: string }> }) {
  const { id } = await params;
  const { tur } = await searchParams;
  const isNew = id === "new";
  if (!isNew && !z.uuid().safeParse(id).success) notFound();
  const block = isNew ? null : await getBlock(id);
  if (!isNew && !block) notFound();
  const type = block?.data.type ?? (tur && tur in DEFAULTS ? tur : null);
  if (!type) notFound();

  const [options, categories] = await Promise.all([getContentOptions(), getAdminCategories()]);
  const data = block?.data ?? DEFAULTS[type];
  // Elle seçilmiş ürünlerin adları (seçici için)
  const ids = (data.productIds as string[] | undefined) ?? [];
  const productNames: Record<string, string> = {};
  await Promise.all(
    ids.slice(0, 24).map(async (pid) => {
      const r = await adminFetch(`/admin/shop/products/${encodeURIComponent(pid)}`);
      if (r.ok) productNames[pid] = ((await r.json()) as { name: string }).name;
    }),
  );

  return (
    <AreaShell icon={LayoutTemplate} title={`${isNew ? "Yeni" : "Düzenle"}: ${BLOCK_LABEL[type]}`} description="Kaydettikten sonra mağaza ana sayfası en geç 1 dakika içinde güncellenir." back={{ href: "/content/home", label: "Ana Sayfa" }}>
      <BlockEditor
        id={block?.id ?? null}
        type={type}
        initial={data}
        initialKey={block?.key ?? ""}
        categories={categories.map(({ id: cid, name }) => ({ id: cid, name }))}
        productNames={productNames}
        icons={options.featureIcons}
        mediaBaseUrl={getMediaBaseUrl()}
      />
    </AreaShell>
  );
}
