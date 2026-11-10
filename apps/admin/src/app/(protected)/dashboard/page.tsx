import Link from "next/link";
import { BarChart3, CircleHelp, Clock, FilePlus2, FileText, FolderTree, Info, LayoutTemplate, ListOrdered, Palette, Phone, ShieldCheck, Megaphone, MessageSquareText, RotateCcw, Images, LayoutDashboard, Package, PackageCheck, PackagePlus, Plus, Scale, ShoppingBag, Store, TicketPercent, Truck, UserCog, Users } from "lucide-react";

import { AreaHeader } from "@/components/areas/AreaShell";
import { getAdminUser } from "@/lib/auth";
import { getPages } from "@/lib/content";
import { getOrders } from "@/lib/orders";
import { getReturns } from "@/lib/returns";
import { getReviews } from "@/lib/reviews";
import { getAdminProducts } from "@/lib/shop";

type Icon = React.ComponentType<{ className?: string }>;

/** Pano: mağazanın her parçası ayrı bir kutucuk; her biri kendi ekranında düzenlenir */
export default async function DashboardPage() {
  const [user, products, lowStock, orders, returns, reviews, pages] = await Promise.all([
    getAdminUser(),
    getAdminProducts({}),
    getAdminProducts({ status: "low-stock" }),
    getOrders({}),
    getReturns({}),
    getReviews({ status: "PENDING" }),
    getPages().catch(() => []),
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

      <Group eyebrow="Satışlar" title="Siparişler">
        <Tile
          href="/orders"
          icon={ShoppingBag}
          title="Sipariş Yönetimi"
          description={`${orders.total} sipariş`}
          badge={toPrepare > 0 && <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[11px] font-bold text-white">{toPrepare} hazırlanacak</span>}
        />
        <Tile href="/orders?durum=PENDING" icon={Clock} title="Ödeme Bekleyen" description={`${c.PENDING ?? 0} sipariş`} />
        <Tile href="/orders?durum=PAID" icon={PackageCheck} title="Hazırlanacaklar" description={`${toPrepare} sipariş (ödeme alındı / hazırlanıyor)`} />
        <Tile href="/reports" icon={BarChart3} title="Satış Raporları" description="Ciro, en çok satanlar, kuponlar, CSV" />
        <Tile
          href="/reviews"
          icon={MessageSquareText}
          title="Yorumlar ve Favoriler"
          description="Onay, yanıt, en çok favorilenen"
          badge={reviews.total > 0 && <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[11px] font-bold text-white">{reviews.total} onay bekliyor</span>}
        />
        <Tile href="/marketing" icon={Megaphone} title="Pazarlama" description="Stok bildirimi, sepet hatırlatma, Google akışı" />
        <Tile
          href="/returns"
          icon={RotateCcw}
          title="İade Talepleri"
          description={`${openReturns} açık talep`}
          badge={(returns.counts.REQUESTED ?? 0) > 0 && <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[11px] font-bold text-white">{returns.counts.REQUESTED} yeni</span>}
        />
      </Group>

      <Group eyebrow="Mağaza Sitesi" title="Site İçeriği">
        <Tile href="/content/theme" icon={Palette} title="Görünüm" description="Renkler, yazı tipi, logo, duyuru, iletişim" />
        <Tile href="/content/home" icon={LayoutTemplate} title="Ana Sayfa" description="Slayt, ürün listeleri, banner, bölümler" />
        <Tile href="/content/faq" icon={CircleHelp} title="S.S.S." description="Sıkça sorulan sorular" />
      </Group>

      <Group
        eyebrow="Mağaza Sitesi"
        title="Sayfalar"
        action={
          <Link href="/content/pages" className="inline-flex items-center gap-1.5 text-xs font-semibold text-(--brand-accent) hover:underline">
            <ListOrdered className="size-4" /> Sıralama ve tüm sayfalar
          </Link>
        }
      >
        {pages.map((p) => (
          <Tile
            key={p.id}
            href={`/content/pages/${p.id}`}
            icon={pageIcon(p.slug)}
            title={p.title}
            description={`/sayfa/${p.slug}`}
            badge={!p.isPublished && <span className="rounded-full bg-neutral-500 px-2 py-0.5 text-[11px] font-bold text-white">Taslak</span>}
          />
        ))}
        <Tile href="/content/pages/new" icon={FilePlus2} title="Yeni Sayfa" description="Kampanya, bilgi veya hikâye sayfası ekle" />
      </Group>

      <Group eyebrow="Katalog" title="Mağaza">
        <Tile
          href="/shop/products"
          icon={Package}
          title="Ürün Yönetimi"
          description={`${products.total} ürün · fiyat, stok, seçenekler, görseller`}
          badge={
            lowStock.total > 0 && (
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">{lowStock.total} stok azaldı</span>
            )
          }
        />
        <Tile href="/shop/products/new" icon={PackagePlus} title="Yeni Ürün" description="Mağazaya ürün ekle" />
        <Tile href="/shop/categories" icon={FolderTree} title="Kategori Yönetimi" description="Kategoriler ve sıralaması" />
        <Tile href="/media" icon={Images} title="Medya Kütüphanesi" description="Yüklenen tüm görseller" />
      </Group>

      <Group eyebrow="Satış" title="Satış Ayarları">
        <Tile href="/shop/coupons" icon={TicketPercent} title="Kupon Yönetimi" description="İndirim kodları ve kullanım sınırları" />
        <Tile href="/shop/shipping" icon={Truck} title="Kargo Ayarları" description="Kargo ücreti, ücretsiz kargo eşiği, en düşük sipariş" />
        <Tile href="/shop/store-info" icon={Store} title="Mağaza Bilgileri" description="Satıcı unvanı, vergi bilgileri, ödeme süresi" />
        <Tile href="/shop/legal" icon={Scale} title="Yasal Metinler" description="Ön bilgilendirme, mesafeli satış, KVKK" />
      </Group>

      <Group eyebrow="Hesaplar" title="Kullanıcılar">
        <Tile href="/users" icon={Users} title="Kullanıcı Yönetimi" description="Müşteriler, yöneticiler, askıya alma, kilit açma" />
        <Tile href="/account" icon={UserCog} title="Hesabım" description="Şifre değiştirme" />
      </Group>
    </div>
  );
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

function Group({
  eyebrow,
  title,
  icon: GroupIcon,
  badge,
  action,
  children,
}: {
  eyebrow?: string;
  title: string;
  icon?: Icon;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
        <div>
          {eyebrow && (
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-(--brand-accent)">
              {eyebrow}
            </p>
          )}
          <h2 className="brand-heading mt-1 flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-(--brand-primary)">
            {GroupIcon && <GroupIcon className="size-5" />}
            {title}
            {badge}
          </h2>
        </div>
        {action}
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {children}
      </div>
    </section>
  );
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
