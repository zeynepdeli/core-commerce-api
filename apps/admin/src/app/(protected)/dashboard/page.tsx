import Link from "next/link";
import { ArrowUpDown, BarChart3, ChevronRight, CircleHelp, Clock, FilePlus2, FileText, FolderTree, GalleryHorizontal, Grid3x3, Image as ImageIcon, Images, Info, LayoutDashboard, LayoutTemplate, Megaphone, MessageSquareText, Package, PackageCheck, PanelBottom, Phone, Plus, RotateCcw, Scale, Search, ShieldCheck, ShoppingBag, ShoppingBasket, Sparkles, Store, TicketPercent, Truck, Type, UserCog, Users } from "lucide-react";

import { AreaHeader } from "@/components/areas/AreaShell";
import { Delta } from "@/components/reports/Delta";
import { getAdminUser } from "@/lib/auth";
import { BLOCK_LABEL, blockTitle, getBlocks, getPages } from "@/lib/content";
import { getOrders } from "@/lib/orders";
import { getReturns } from "@/lib/returns";
import { getReviews } from "@/lib/reviews";
import { getSalesReport } from "@/lib/reports";
import { formatPrice, getAdminProducts } from "@/lib/shop";
import { THEME_SECTIONS } from "@/lib/theme-sections";

type Icon = React.ComponentType<{ className?: string }>;

const TZ = "Europe/Istanbul";
const iso = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const daysAgo = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);

/** Pano: bölüm bölüm (istatistikler en üstte); her parça kendi kutusu, kendi ekranında düzenlenir */
export default async function DashboardPage() {
  const today = iso(new Date());
  const [user, products, lowStock, orders, returns, reviews, pages, blocks, sales] = await Promise.all([
    getAdminUser(),
    getAdminProducts({}),
    getAdminProducts({ status: "low-stock" }),
    getOrders({}),
    getReturns({}),
    getReviews({ status: "PENDING" }),
    getPages().catch(() => []),
    getBlocks().catch(() => []),
    // İstatistikler yüklenemezse pano yine açılır
    getSalesReport({ from: daysAgo(today, 29), to: today }).catch(() => ({ error: "Rapor yüklenemedi." })),
  ]);
  const openReturns = (returns.counts.REQUESTED ?? 0) + (returns.counts.APPROVED ?? 0) + (returns.counts.RECEIVED ?? 0);
  const c = orders.statusCounts;
  const toPrepare = (c.PAID ?? 0) + (c.PROCESSING ?? 0);
  const report = "report" in sales ? sales.report : null;

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1800px] space-y-9 pb-12">
      <AreaHeader
        icon={LayoutDashboard}
        eyebrow="Yönetim Paneli"
        title="Dashboard"
        description={`Hoş geldiniz${user ? `, ${user.name}` : ""}. Düzenlemek istediğiniz bölüme tıklayın; her biri kendi ekranında açılır.`}
        actions={
          <Link
            href="/shop/products/new"
            className="inline-flex items-center gap-2 rounded-full bg-(--brand-primary) px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] text-white transition hover:bg-(--brand-primary)/90"
          >
            <Plus className="size-4" />
            Yeni Ürün
          </Link>
        }
      />

      <Section
        icon={BarChart3}
        title="İstatistikler"
        note="Son 30 gün"
        action={<SectionLink href="/reports">Satış raporları</SectionLink>}
      >
        {report ? (
          <>
            <Stat href="/reports?aralik=30" label="Ciro" value={formatPrice(report.summary.gross)} delta={report.change.gross} />
            <Stat href="/reports?aralik=30" label="Sipariş" value={report.summary.orders.toLocaleString("tr-TR")} delta={report.change.orders} />
            <Stat href="/reports?aralik=30" label="Ortalama sepet" value={formatPrice(report.summary.aov)} delta={report.change.aov} />
            <Stat href="/reports?aralik=30" label="Satılan ürün" value={report.summary.itemsSold.toLocaleString("tr-TR")} delta={report.change.itemsSold} />
          </>
        ) : (
          <p className="col-span-full rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">İstatistikler şu an yüklenemedi.</p>
        )}
      </Section>

      <Section icon={ShoppingBag} title="Siparişler">
        <Tile href="/orders" icon={ShoppingBag} title="Tüm Siparişler" description={`${orders.total} sipariş`} />
        <Tile href="/orders?durum=PENDING" icon={Clock} title="Ödeme Bekleyen" description={`${c.PENDING ?? 0} sipariş`} />
        <Tile
          href="/orders?durum=PAID"
          icon={PackageCheck}
          title="Hazırlanacaklar"
          description="Ödemesi alınmış, kargoya verilecek"
          badge={toPrepare > 0 && <Badge tone="info">{toPrepare}</Badge>}
        />
        <Tile
          href="/returns"
          icon={RotateCcw}
          title="İade Talepleri"
          description={`${openReturns} açık talep`}
          badge={(returns.counts.REQUESTED ?? 0) > 0 && <Badge tone="warning">{returns.counts.REQUESTED} yeni</Badge>}
        />
        <Tile
          href="/reviews"
          icon={MessageSquareText}
          title="Yorumlar ve Favoriler"
          description="Onay, yanıt, en çok favorilenen"
          badge={reviews.total > 0 && <Badge tone="warning">{reviews.total} onay bekliyor</Badge>}
        />
      </Section>

      <Section icon={Search} title="Google'da Görünürlük" note="Arama sonuçları ve sosyal medya paylaşımları">
        <Tile href="/content/theme/seo" icon={Search} title="SEO Ayarları" description="Google'da görünen başlık ve açıklama, paylaşım görseli" />
      </Section>

      {/* Sitenin her parçası, sitedeki sırasıyla: üst → ana sayfa → katalog → bilgi sayfaları → alt → genel görünüm */}
      <Section icon={FileText} title="Sayfalar" action={<SectionLink href="/content/pages">Sıralama ve tüm sayfalar</SectionLink>}>
        <Tile href="/content/theme/header" icon={THEME_SECTIONS.header.icon} title="Header" description={THEME_SECTIONS.header.description} />
        {blocks.map((b) => (
          <Tile
            key={b.id}
            href={`/content/home/${b.id}`}
            icon={BLOCK_ICON[b.data.type] ?? LayoutTemplate}
            title={blockTitle(b.data)}
            description={`Ana sayfa · ${BLOCK_LABEL[b.data.type] ?? b.data.type}`}
            badge={!b.isActive && <Badge tone="muted">Pasif</Badge>}
          />
        ))}
        <Tile href="/content/home" icon={ArrowUpDown} title="Ana Sayfa Düzeni" description="Bölümleri sırala, yeni bölüm ekle (slider, ürün listesi, banner…)" />
        <Tile
          href="/shop/products"
          icon={Package}
          title="Ürünler"
          description={`${products.total} ürün · fiyat, stok, seçenekler, görseller`}
          badge={lowStock.total > 0 && <Badge tone="danger">{lowStock.total} stok azaldı</Badge>}
        />
        <Tile href="/shop/categories" icon={FolderTree} title="Kategoriler" description="Kategoriler ve sıralaması" />
        {pages.map((p) => (
          <Tile
            key={p.id}
            href={`/content/pages/${p.id}`}
            icon={pageIcon(p.slug)}
            title={p.title}
            description={`/sayfa/${p.slug}`}
            badge={!p.isPublished && <Badge tone="muted">Taslak</Badge>}
          />
        ))}
        <Tile href="/content/faq" icon={CircleHelp} title="S.S.S." description="Sıkça sorulan sorular" />
        <Tile href="/content/footer" icon={PanelBottom} title="Footer" description="Sosyal medya, iletişim, kampanya kutusu" />
        <Tile href="/content/theme/renkler" icon={THEME_SECTIONS.renkler.icon} title={THEME_SECTIONS.renkler.title} description="Sitenin tamamındaki renkler ve yazı tipleri" />
        <Tile href="/content/theme/arka-plan" icon={THEME_SECTIONS["arka-plan"].icon} title={THEME_SECTIONS["arka-plan"].title} description={THEME_SECTIONS["arka-plan"].description} />
        <Tile href="/media" icon={Images} title="Medya Kütüphanesi" description="Yüklenen tüm görseller" />
        <Tile href="/content/pages/new" icon={FilePlus2} title="Yeni Sayfa" description="Kampanya, bilgi veya hikâye sayfası ekle" />
      </Section>

      <Section icon={TicketPercent} title="Satış ve Pazarlama">
        <Tile href="/shop/coupons" icon={TicketPercent} title="Kuponlar" description="İndirim kodları ve kullanım sınırları" />
        <Tile href="/shop/shipping" icon={Truck} title="Kargo Ayarları" description="Kargo ücreti, ücretsiz kargo eşiği, en düşük sipariş" />
        <Tile href="/marketing" icon={Megaphone} title="Pazarlama" description="Stok bildirimi, sepet hatırlatma, Google akışı" />
        <Tile href="/shop/store-info" icon={Store} title="Mağaza Bilgileri" description="Satıcı unvanı, vergi bilgileri, ödeme süresi" />
        <Tile href="/shop/legal" icon={Scale} title="Yasal Metinler" description="Ön bilgilendirme, mesafeli satış, KVKK, çerez politikası" />
      </Section>

      <Section icon={Users} title="Hesaplar">
        <Tile href="/users" icon={Users} title="Kullanıcılar" description="Müşteriler, yöneticiler, askıya alma, kilit açma" />
        <Tile href="/account" icon={UserCog} title="Hesabım" description="Şifre değiştirme" />
      </Section>
    </div>
  );
}

function Section({ icon: SectionIcon, title, note, action, children }: { icon: Icon; title: string; note?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
        <h2 className="brand-heading flex flex-wrap items-baseline gap-2 text-2xl font-bold tracking-tight text-(--brand-primary)">
          <SectionIcon className="size-5 self-center" />
          {title}
          {note && <span className="text-sm font-medium text-muted-foreground">{note}</span>}
        </h2>
        {action}
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">{children}</div>
    </section>
  );
}

function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-xs font-semibold text-(--brand-accent) hover:underline">
      {children} <ChevronRight className="size-4" />
    </Link>
  );
}

/** İstatistik kartı: rapora götürür */
function Stat({ href, label, value, delta }: { href: string; label: string; value: string; delta: number | null }) {
  return (
    <Link href={href} className="rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-(--brand-accent)/40 hover:shadow-md">
      <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <span className="mt-2 block text-3xl font-bold tracking-tight text-(--brand-primary) tabular-nums">{value}</span>
      <span className="mt-1 block min-h-4">
        <Delta value={delta} />
      </span>
    </Link>
  );
}

const BLOCK_ICON: Record<string, Icon> = {
  HERO: GalleryHorizontal,
  PRODUCT_LIST: ShoppingBasket,
  CATEGORY_GRID: Grid3x3,
  BANNER: ImageIcon,
  TEXT: Type,
  FEATURES: Sparkles,
};

const BADGE_TONE = {
  info: "bg-sky-600 text-white",
  warning: "bg-amber-600 text-white",
  danger: "bg-red-600 text-white",
  muted: "bg-neutral-500 text-white",
} as const;

function Badge({ tone, children }: { tone: keyof typeof BADGE_TONE; children: React.ReactNode }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${BADGE_TONE[tone]}`}>{children}</span>;
}

/** Sayfa adresine göre tanıdık bir simge */
function pageIcon(slug: string): Icon {
  if (/hakkimizda|hikaye|biz/.test(slug)) return Info;
  if (/iletisim|bize-ulasin/.test(slug)) return Phone;
  if (/kargo|teslimat/.test(slug)) return Truck;
  if (/iade|degisim/.test(slug)) return RotateCcw;
  if (/gizlilik|guvenlik|kvkk/.test(slug)) return ShieldCheck;
  return FileText;
}

function Tile({
  href,
  icon: TileIcon,
  title,
  description,
  number,
  badge,
}: {
  href: string;
  icon: Icon;
  title: string;
  description?: string;
  number?: number;
  badge?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-28 items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-(--brand-accent)/40 hover:shadow-md"
    >
      <span className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-(--brand-primary)/10 text-(--brand-primary) transition group-hover:bg-(--brand-primary) group-hover:text-white">
        {number ? (
          <span className="text-sm font-bold">{number}</span>
        ) : (
          <TileIcon className="size-5" />
        )}
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-1.5 text-base font-bold text-(--brand-primary)">
          <span className="truncate">{title}</span>
          {badge}
        </span>
        {description && (
          <span className="mt-1 block text-sm leading-5 text-muted-foreground">
            {description}
          </span>
        )}
      </span>
    </Link>
  );
}
