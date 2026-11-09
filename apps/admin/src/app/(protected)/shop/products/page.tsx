import Link from "next/link";
import { AlertTriangle, EyeOff, Package, Plus, Search, Star } from "lucide-react";

import { AreaCard, AreaShell } from "@/components/areas/AreaShell";
import { DeleteProductButton } from "@/components/shop/DeleteProductButton";
import { getMediaBaseUrl } from "@/lib/media-base-url";
import { mediaSrc } from "@/lib/media-src";
import { formatPrice, getAdminCategories, getAdminProducts } from "@/lib/shop";

const STATUSES = [
  { value: "", label: "Tümü" },
  { value: "active", label: "Yayında" },
  { value: "inactive", label: "Gizli" },
  { value: "low-stock", label: "Stoğu azalan" },
] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kategori?: string; durum?: string; sayfa?: string }>;
}) {
  const sp = await searchParams;
  // Kullanıcının adres çubuğuna yazdıkları doğrulanır
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const category = sp.kategori && UUID.test(sp.kategori) ? sp.kategori : "";
  const status = STATUSES.some((s) => s.value === sp.durum) ? (sp.durum ?? "") : "";
  const page = Math.min(Math.max(Number.parseInt(sp.sayfa ?? "1", 10) || 1, 1), 10000);

  const [categories, result] = await Promise.all([
    getAdminCategories(),
    getAdminProducts({ q, category, status, page }),
  ]);
  const mediaBaseUrl = getMediaBaseUrl();

  const href = (p: number) => {
    const s = new URLSearchParams();
    if (q) s.set("q", q);
    if (category) s.set("kategori", category);
    if (status) s.set("durum", status);
    if (p > 1) s.set("sayfa", String(p));
    const qs = s.toString();
    return `/shop/products${qs ? `?${qs}` : ""}`;
  };

  return (
    <AreaShell
      icon={Package}
      title="Ürün Yönetimi"
      description="Satıştaki ürünler: fiyat, stok, görseller ve ürün sayfası içerikleri."
      actions={
        <Link
          href="/shop/products/new"
          className="inline-flex items-center gap-2 rounded-full bg-(--brand-primary) px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] text-white transition hover:bg-(--brand-primary)/90"
        >
          <Plus className="size-4" />
          Yeni Ürün
        </Link>
      }
    >
      <AreaCard title={`Ürünler (${result.total})`}>
        <form method="get" className="mb-5 grid gap-3 @2xl:grid-cols-[1fr_220px_180px_auto]">
          <label className="relative">
            <span className="sr-only">Ürün ara</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              defaultValue={q}
              maxLength={100}
              placeholder="Ad, açıklama veya stok kodu (SKU)"
              className="min-h-11 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-sm"
            />
          </label>
          <select name="kategori" defaultValue={category} aria-label="Kategori" className="min-h-11 rounded-xl border border-border bg-surface px-3 text-sm">
            <option value="">Tüm kategoriler</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select name="durum" defaultValue={status} aria-label="Durum" className="min-h-11 rounded-xl border border-border bg-surface px-3 text-sm">
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button type="submit" className="min-h-11 rounded-xl bg-(--brand-primary) px-5 text-sm font-semibold text-white">
            Filtrele
          </button>
        </form>

        {result.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            {q || category || status ? "Bu filtreye uyan ürün yok." : "Henüz ürün yok. Sağ üstten ilk ürünü ekleyin."}
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {result.items.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-4 p-4">
                <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-muted">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaSrc(p.image.url, mediaBaseUrl)} alt={p.image.alt ?? ""} className="size-full object-cover" />
                  ) : (
                    <Package className="size-5 text-muted-foreground" />
                  )}
                </span>
                <Link href={`/shop/products/${p.id}`} className="min-w-0 flex-1 hover:text-(--brand-accent)">
                  <span className="flex flex-wrap items-center gap-2 font-semibold text-(--brand-primary)">
                    {p.name}
                    {!p.isActive && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-500/10 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
                        <EyeOff className="size-3" />
                        Gizli
                      </span>
                    )}
                    {p.featured && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                        <Star className="size-3" />
                        Öne çıkan
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {p.category?.name ?? ""}
                    {p.variantCount > 1 ? ` · ${p.variantCount} seçenek` : p.variantName ? ` · ${p.variantName}` : ""}
                    {p.sku ? ` · ${p.sku}` : ""}
                  </span>
                </Link>
                <div className="text-right">
                  {p.variantCount > 1 && <p className="text-[11px] text-muted-foreground">en düşük</p>}
                  <p className="font-semibold">{formatPrice(p.price)}</p>
                  {p.compareAtPrice && <p className="text-xs text-muted-foreground line-through">{formatPrice(p.compareAtPrice)}</p>}
                </div>
                <div className="w-28 text-right text-sm">
                  {p.totalStock === null ? (
                    <span className="text-muted-foreground">Stok takibi yok</span>
                  ) : p.lowStock ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-red-600" title="En az bir seçeneğin stoğu 5'in altında">
                      <AlertTriangle className="size-3.5" />
                      {p.totalStock} adet
                    </span>
                  ) : (
                    <span>{p.totalStock} adet</span>
                  )}
                </div>
                <DeleteProductButton id={p.id} name={p.name} />
              </li>
            ))}
          </ul>
        )}

        {result.pages > 1 && (
          <nav aria-label="Sayfalar" className="mt-5 flex items-center justify-between text-sm">
            {result.page > 1 ? <Link href={href(result.page - 1)} className="font-semibold text-(--brand-accent)">← Önceki</Link> : <span />}
            <span className="text-muted-foreground">
              Sayfa {result.page} / {result.pages}
            </span>
            {result.page < result.pages ? <Link href={href(result.page + 1)} className="font-semibold text-(--brand-accent)">Sonraki →</Link> : <span />}
          </nav>
        )}
      </AreaCard>
    </AreaShell>
  );
}
