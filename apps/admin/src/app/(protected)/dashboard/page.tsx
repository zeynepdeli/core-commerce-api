import Link from "next/link";
import { ArrowUpDown, BarChart3, CircleHelp, Clock, FilePlus2, FileText, FolderTree, GalleryHorizontal, Grid3x3, Image as ImageIcon, Images, Info, LayoutDashboard, LayoutTemplate, ListOrdered, Megaphone, MessageSquareText, Package, PackageCheck, PanelBottom, Phone, Plus, RotateCcw, Scale, ShieldCheck, ShoppingBag, ShoppingBasket, Sparkles, Store, TicketPercent, Truck, Type, UserCog, Users } from "lucide-react";

import { AreaHeader } from "@/components/areas/AreaShell";
import { getAdminUser } from "@/lib/auth";
import { BLOCK_LABEL, blockTitle, getBlocks, getPages } from "@/lib/content";
import { getOrders } from "@/lib/orders";
import { getReturns } from "@/lib/returns";
import { getReviews } from "@/lib/reviews";
import { getAdminProducts } from "@/lib/shop";
import { THEME_SECTIONS } from "@/lib/theme-sections";

type Icon = React.ComponentType<{ className?: string }>;

/** Pano: mağazanın her parçası ayrı bir kutu (gruplama yok); her biri kendi ekranında düzenlenir */
export default async function DashboardPage() {
  const [user, products, lowStock, orders, returns, reviews, pages, blocks] = await Promise.all([
    getAdminUser(),
    getAdminProducts({}),
    getAdminProducts({ status: "low-stock" }),
    getOrders({}),
    getReturns({}),
    getReviews({ status: "PENDING" }),
    getPages().catch(() => []),
    getBlocks().catch(() => []),
  ]);
  const openReturns = (returns.counts.REQUESTED ?? 0) + (returns.counts.APPROVED ?? 0) + (returns.counts.RECEIVED ?? 0);
  const c = orders.statusCounts;
  const toPrepare = (c.PAID ?? 0) + (c.PROCESSING ?? 0);

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1800px] space-y-7 pb-12">
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {/* Satış */}
        <Tile
          href="/orders"
          icon={ShoppingBag}
          title="Siparişler"
          description={`${orders.total} sipariş`}
          badge={toPrepare > 0 && <Badge tone="info">{toPrepare} hazırlanacak</Badge>}
        />
        <Tile href="/orders?durum=PENDING" icon={Clock} title="Ödeme Bekleyen" description={`${c.PENDING ?? 0} sipariş`} />
        <Tile href="/orders?durum=PAID" icon={PackageCheck} title="Hazırlanacaklar" description={`${toPrepare} sipariş (ödeme alındı / hazırlanıyor)`} />
        <Tile
          href="/shop/products"
          icon={Package}
          title="Ürünler"
          description={`${products.total} ürün · fiyat, stok, seçenekler, görseller`}
          badge={lowStock.total > 0 && <Badge tone="danger">{lowStock.total} stok azaldı</Badge>}
        />
        <Tile href="/shop/categories" icon={FolderTree} title="Kategoriler" description="Kategoriler ve sıralaması" />
        <Tile href="/users" icon={Users} title="Kullanıcılar" description="Müşteriler, yöneticiler, askıya alma, kilit açma" />

        {/* Görünüm */}
        {(Object.keys(THEME_SECTIONS) as (keyof typeof THEME_SECTIONS)[]).map((key) => {
          const t = THEME_SECTIONS[key];
          return <Tile key={key} href={`/content/theme/${key}`} icon={t.icon} title={t.title} description={t.description} />;
        })}

        {/* Ana sayfa: her bölüm ayrı kutu */}
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

        {/* Bilgi sayfaları: her sayfa ayrı kutu */}
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
        <Tile href="/content/pages/new" icon={FilePlus2} title="Yeni Sayfa" description="Kampanya, bilgi veya hikâye sayfası ekle" />
        <Tile href="/content/pages" icon={ListOrdered} title="Sayfa Sıralaması" description="Tüm sayfalar ve sıraları" />

        <Tile href="/content/footer" icon={PanelBottom} title="Footer" description="Sosyal medya, iletişim, kampanya kutusu" />
        <Tile href="/content/faq" icon={CircleHelp} title="S.S.S." description="Sıkça sorulan sorular" />
        <Tile href="/media" icon={Images} title="Medya Kütüphanesi" description="Yüklenen tüm görseller" />

        {/* Müşteri ve satış sonrası */}
        <Tile
          href="/reviews"
          icon={MessageSquareText}
          title="Yorumlar ve Favoriler"
          description="Onay, yanıt, en çok favorilenen"
          badge={reviews.total > 0 && <Badge tone="warning">{reviews.total} onay bekliyor</Badge>}
        />
        <Tile
          href="/returns"
          icon={RotateCcw}
          title="İade Talepleri"
          description={`${openReturns} açık talep`}
          badge={(returns.counts.REQUESTED ?? 0) > 0 && <Badge tone="warning">{returns.counts.REQUESTED} yeni</Badge>}
        />
        <Tile href="/reports" icon={BarChart3} title="Satış Raporları" description="Ciro, en çok satanlar, kuponlar, CSV" />
        <Tile href="/marketing" icon={Megaphone} title="Pazarlama" description="Stok bildirimi, sepet hatırlatma, Google akışı" />

        {/* Satış ayarları */}
        <Tile href="/shop/coupons" icon={TicketPercent} title="Kuponlar" description="İndirim kodları ve kullanım sınırları" />
        <Tile href="/shop/shipping" icon={Truck} title="Kargo Ayarları" description="Kargo ücreti, ücretsiz kargo eşiği, en düşük sipariş" />
        <Tile href="/shop/store-info" icon={Store} title="Mağaza Bilgileri" description="Satıcı unvanı, vergi bilgileri, ödeme süresi" />
        <Tile href="/shop/legal" icon={Scale} title="Yasal Metinler" description="Ön bilgilendirme, mesafeli satış, KVKK" />
        <Tile href="/account" icon={UserCog} title="Hesabım" description="Şifre değiştirme" />
      </div>
    </div>
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
