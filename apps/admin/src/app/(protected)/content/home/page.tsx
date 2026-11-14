import Link from "next/link";
import { LayoutTemplate, Plus } from "lucide-react";

import { AreaCard, AreaShell } from "@/components/areas/AreaShell";
import { BlockList } from "@/components/content/BlockList";
import { BLOCK_LABEL, getBlocks } from "@/lib/content";

const fmt = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" });

function summary(d: Record<string, unknown>) {
  switch (d.type) {
    case "HERO":
      return `${(d.slides as unknown[]).length} slayt${(d.slides as { heading?: string }[])[0]?.heading ? ` · ${(d.slides as { heading?: string }[])[0].heading}` : ""}`;
    case "PRODUCT_LIST":
      return `${(d.title as string) ?? "Başlıksız"}${d.display === "hero" ? " · slider içinde" : ""} · ${({ featured: "öne çıkanlar", new: "en yeniler", bestsellers: "çok satanlar", rating: "en beğenilenler", category: "kategoriden", manual: "elle seçilen" } as Record<string, string>)[d.source as string]} · ${d.limit} ürün`;
    case "CATEGORY_GRID":
      return `${(d.title as string) ?? "Kategoriler"} · ${(d.categoryIds as unknown[] | undefined)?.length || "tüm"} kategori`;
    case "BANNER":
      return (d.heading as string) ?? "Görsel banner";
    case "TEXT":
      return (d.title as string) ?? String(d.body).slice(0, 80);
    case "FEATURES":
      return (d.items as { title: string }[]).map((i) => i.title).join(" · ");
    default:
      return "";
  }
}

function schedule(d: Record<string, unknown>) {
  const from = d.visibleFrom as string | undefined;
  const until = d.visibleUntil as string | undefined;
  if (!from && !until) return null;
  const now = Date.now();
  const state = from && Date.parse(from) > now ? "Henüz yayında değil" : until && Date.parse(until) <= now ? "Süresi bitti" : "Planlı";
  return `${state}: ${from ? fmt.format(new Date(from)) : "…"} – ${until ? fmt.format(new Date(until)) : "…"}`;
}

export default async function HomeContentPage() {
  const blocks = await getBlocks();
  return (
    <AreaShell icon={LayoutTemplate} title="Ana Sayfa" description="Mağaza ana sayfasındaki bölümler; yukarıdan aşağı bu sırayla görünür." back={{ href: "/dashboard", label: "Dashboard" }}>
      <AreaCard title={`Bölümler (${blocks.length})`}>
        <BlockList
          editBase="/content/home"
          rows={blocks.map((b) => ({ id: b.id, key: b.key, type: b.data.type, label: BLOCK_LABEL[b.data.type] ?? b.data.type, summary: summary(b.data), isActive: b.isActive, scheduled: schedule(b.data) }))}
        />
      </AreaCard>
      <AreaCard title="Bölüm Ekle">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Object.entries(BLOCK_LABEL).map(([type, label]) => (
            <Link key={type} href={`/content/home/new?tur=${type}`} className="flex items-center gap-2 rounded-2xl border border-border p-4 text-sm font-semibold hover:bg-surface-muted">
              <Plus className="size-4" /> {label}
            </Link>
          ))}
        </div>
      </AreaCard>
    </AreaShell>
  );
}
