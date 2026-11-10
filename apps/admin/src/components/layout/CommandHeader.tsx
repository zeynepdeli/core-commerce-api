"use client";

import { BRAND } from "@/brand/brand";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  BarChart3,
  Blocks,
  ChevronDown,
  CircleUserRound,
  Images,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ShoppingBag,
  UserCog,
  Users,
  X,
} from "lucide-react";

import { logoutAdmin } from "@/app/actions";

// Üst menü: en sık kullanılan ekranlar (hepsi Dashboard'da da var)
const navigation = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Siparişler", href: "/orders", icon: ShoppingBag },
  { label: "Raporlar", href: "/reports", icon: BarChart3 },
  { label: "Ürünler", href: "/shop/products", icon: Package },
  { label: "Kategoriler", href: "/shop/categories", icon: FolderTree },
  { label: "Medya", href: "/media", icon: Images },
] as const;

export default function CommandHeader() {
  const pathname = usePathname();

  return <HeaderContent key={pathname} pathname={pathname} />;
}

type HeaderContentProps = {
  pathname: string;
};

function HeaderContent({ pathname }: HeaderContentProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setProfileOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        mobileButtonRef.current?.focus();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const elements = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );

      if (!elements.length) return;

      const first = elements[0];
      const last = elements[elements.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProfileOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function closeMobileMenu() {
    setMobileOpen(false);
    mobileButtonRef.current?.focus();
  }

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border bg-surface/95 backdrop-blur-xl">
        <div className="flex h-17 w-full items-center justify-between gap-3 px-3 sm:px-4 lg:px-6">
          {/* Logo */}
          <Link
            href="/dashboard"
            className="flex min-w-0 shrink-0 items-center gap-3"
          >
            {BRAND.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={BRAND.logo} alt="" className="h-10 w-auto max-w-32 object-contain" />
            ) : (
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Blocks size={21} strokeWidth={1.8} />
              </span>
            )}

            <span className="brand-heading hidden truncate text-base font-bold tracking-tight text-foreground sm:block">
              {BRAND.name}
            </span>
          </Link>

          {/* Masaüstü navigasyon */}
          <nav
            aria-label="Ana navigasyon"
            className="hidden min-w-0 items-center gap-0.5 xl:flex"
          >
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2.5 text-sm font-medium transition-colors 2xl:px-3.5 ${
                    active
                      ? "bg-surface-muted text-foreground"
                      : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                  }`}
                >
                  <Icon
                    size={17}
                    strokeWidth={1.8}
                    className={active ? "text-accent" : ""}
                  />

                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Sağ araçlar */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {/* Profil menüsü */}
            <div ref={profileRef} className="relative">
              <button
                type="button"
                aria-label="Kullanıcı menüsü"
                aria-expanded={profileOpen}
                aria-controls="admin-profile-menu"
                onClick={() => {
                  setProfileOpen((previous) => !previous);
                  setMobileOpen(false);
                }}
                className="flex h-10 items-center gap-2 rounded-xl border border-border px-2.5 text-foreground transition-colors hover:bg-surface-muted sm:px-3"
              >
                <CircleUserRound size={19} />

                <ChevronDown
                  size={14}
                  className={`text-muted-foreground transition-transform ${
                    profileOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {profileOpen && (
                <div
                  id="admin-profile-menu"
                  className="absolute top-full right-0 z-50 mt-3 w-[min(16rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-2 shadow-xl"
                >
                  <div className="flex items-center gap-3 border-b border-border px-3 py-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-accent">
                      <CircleUserRound size={22} />
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        Yönetici Hesabı
                      </p>

                      <p className="text-xs text-muted-foreground">
                        Yönetici
                      </p>
                    </div>
                  </div>

                  <Link
                    href="/account"
                    className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
                  >
                    <UserCog size={17} />
                    Hesap Ayarları
                  </Link>

                  <Link
                    href="/users"
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
                  >
                    <Users size={17} />
                    Yöneticiler
                  </Link>

                  <form action={logoutAdmin}>
                    <button
                      type="submit"
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                    >
                      <LogOut size={17} />
                      Güvenli Çıkış
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Mobil / tablet menü butonu */}
            <button
              ref={mobileButtonRef}
              type="button"
              aria-label={mobileOpen ? "Menüyü kapat" : "Menüyü aç"}
              aria-expanded={mobileOpen}
              aria-controls="admin-mobile-navigation"
              onClick={() => {
                setMobileOpen((previous) => !previous);
                setProfileOpen(false);
              }}
              className="flex size-10 items-center justify-center rounded-xl border border-border text-foreground transition-colors hover:bg-surface-muted xl:hidden"
            >
              {mobileOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobil / tablet navigasyon */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          {/* Arka plan */}
          <button
            type="button"
            aria-label="Navigasyonu kapat"
            tabIndex={-1}
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]"
            onClick={closeMobileMenu}
          />

          {/* Menü paneli */}
          <div
            ref={dialogRef}
            id="admin-mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Yönetim navigasyonu"
            className="absolute inset-x-3 top-3 max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-surface p-4 shadow-2xl sm:inset-x-auto sm:right-5 sm:w-90"
          >
            {/* Menü başlığı */}
            <div className="mb-5 flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Blocks size={20} />
                </span>

                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {BRAND.name}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    Yönetim menüsü
                  </p>
                </div>
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Menüyü kapat"
                onClick={closeMobileMenu}
                className="flex size-9 items-center justify-center rounded-lg bg-surface-muted text-foreground transition-colors hover:bg-surface-muted/80"
              >
                <X size={19} />
              </button>
            </div>

            {/* Mobil menü bağlantıları */}
            <nav aria-label="Mobil navigasyon" className="grid gap-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={`flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                      active
                        ? "bg-surface-muted text-foreground"
                        : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                    }`}
                  >
                    <Icon
                      size={19}
                      strokeWidth={1.8}
                      className={active ? "text-accent" : ""}
                    />

                    <span>{item.label}</span>

                    {active && (
                      <span className="ml-auto size-1.5 rounded-full bg-accent" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Mobil çıkış */}
            <div className="mt-5 border-t border-border pt-4">
              <form action={logoutAdmin}>
                <button
                  type="submit"
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                >
                  <LogOut size={19} />
                  Güvenli Çıkış
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
