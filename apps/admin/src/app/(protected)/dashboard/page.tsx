import Link from "next/link";
import { FolderTree, Images, LayoutDashboard, Package, PackagePlus, Plus, UserCog, Users } from "lucide-react";

import { AreaHeader } from "@/components/areas/AreaShell";
import { getAdminUser } from "@/lib/auth";
import { getAdminProducts } from "@/lib/shop";

type Icon = React.ComponentType<{ className?: string }>;

/** Pano: mağazanın her parçası ayrı bir kutucuk; her biri kendi ekranında düzenlenir */
export default async function DashboardPage() {
  const [user, products, lowStock] = await Promise.all([
    getAdminUser(),
    getAdminProducts({}),
    getAdminProducts({ status: "low-stock" }),
  ]);

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

      <Group eyebrow="Hesaplar" title="Kullanıcılar">
        <Tile href="/users" icon={Users} title="Kullanıcı Yönetimi" description="Müşteriler, yöneticiler, askıya alma, kilit açma" />
        <Tile href="/account" icon={UserCog} title="Hesabım" description="Şifre değiştirme" />
      </Group>
    </div>
  );
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
