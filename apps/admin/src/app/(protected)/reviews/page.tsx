import Link from "next/link";
import { MessageSquareText, Search } from "lucide-react";

import { AreaCard, AreaShell } from "@/components/areas/AreaShell";
import { AutoApproveToggle } from "@/components/reviews/AutoApproveToggle";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { REVIEW_LABEL, getReviews, getTopFavorites, type ReviewStatus } from "@/lib/reviews";
import { getStoreSettings } from "@/lib/store";

const STATUSES = Object.keys(REVIEW_LABEL) as ReviewStatus[];

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ durum?: string; q?: string; sayfa?: string }> }) {
  const sp = await searchParams;
  const status = STATUSES.includes(sp.durum as ReviewStatus) ? (sp.durum as ReviewStatus) : sp.durum === "hepsi" ? "" : "PENDING";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const page = Math.min(Math.max(Number.parseInt(sp.sayfa ?? "1", 10) || 1, 1), 10000);
  const [result, settings, favorites] = await Promise.all([getReviews({ status, q, page }), getStoreSettings(), getTopFavorites()]);
  const all = Object.values(result.counts).reduce((a, b) => a + (b ?? 0), 0);
  const href = (next: { durum?: string; sayfa?: number }) => {
    const s = new URLSearchParams();
    s.set("durum", next.durum ?? (status || "hepsi"));
    if (q) s.set("q", q);
    if (next.sayfa && next.sayfa > 1) s.set("sayfa", String(next.sayfa));
    return `/reviews?${s}`;
  };
  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-xs font-semibold ${on ? "border-(--brand-primary) bg-(--brand-primary) text-white" : "border-border"}`;

  return (
    <AreaShell icon={MessageSquareText} title="Yorumlar ve Favoriler" description="Müşteri yorumlarını onaylayın, yanıtlayın; en çok favorilenen ürünleri görün.">
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <AreaCard title="Yorumlar">
          <nav aria-label="Durum" className="mb-4 flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <Link key={s} href={href({ durum: s })} className={chip(status === s)}>
                {REVIEW_LABEL[s]} ({result.counts[s] ?? 0})
              </Link>
            ))}
            <Link href={href({ durum: "hepsi" })} className={chip(!status)}>
              Tümü ({all})
            </Link>
          </nav>
          <form method="get" className="mb-5 flex gap-3">
            <input type="hidden" name="durum" value={status || "hepsi"} />
            <label className="relative flex-1">
              <span className="sr-only">Yorum ara</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input name="q" defaultValue={q} maxLength={100} placeholder="Ürün, yorum metni veya e-posta" className="min-h-11 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-sm" />
            </label>
            <button type="submit" className="min-h-11 rounded-xl bg-(--brand-primary) px-5 text-sm font-semibold text-white">
              Ara
            </button>
          </form>
          {result.items.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Yorum yok.</p>
          ) : (
            <div className="grid gap-3">
              {result.items.map((r) => (
                <ReviewCard key={`${r.id}-${r.status}-${r.reply ?? ""}`} r={r} />
              ))}
            </div>
          )}
          {result.pages > 1 && (
            <nav aria-label="Sayfalar" className="mt-5 flex items-center justify-between text-sm">
              {result.page > 1 ? <Link href={href({ sayfa: result.page - 1 })} className="font-semibold text-(--brand-accent)">← Önceki</Link> : <span />}
              <span className="text-muted-foreground">Sayfa {result.page} / {result.pages}</span>
              {result.page < result.pages ? <Link href={href({ sayfa: result.page + 1 })} className="font-semibold text-(--brand-accent)">Sonraki →</Link> : <span />}
            </nav>
          )}
        </AreaCard>
        <div className="space-y-5">
          <AreaCard title="Ayar">
            <AutoApproveToggle on={settings.reviewAutoApprove} />
          </AreaCard>
          <AreaCard title="En Çok Favorilenen">
            {favorites.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz favori yok.</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {favorites.map((f) => (
                  <li key={f.productId} className="flex justify-between gap-3">
                    <Link href={`/shop/products/${f.productId}`} className="truncate font-medium hover:underline">
                      {f.name}
                    </Link>
                    <span className="tabular-nums text-muted-foreground">{f.count}</span>
                  </li>
                ))}
              </ol>
            )}
          </AreaCard>
        </div>
      </div>
    </AreaShell>
  );
}
