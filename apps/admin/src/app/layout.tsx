import "@/lib/validations/zod-locale";
import type { Metadata } from "next";
// Yazı tipi dosyaları pakette: derleme sırasında internet gerekmez
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { BRAND } from "@/brand/brand";

const geistSans = GeistSans;

const geistMono = GeistMono;

export const metadata: Metadata = {
  title: { default: `${BRAND.name} · Yönetim Paneli`, template: `%s · ${BRAND.name}` },
  // Yönetim paneli arama motorlarında görünmesin
  robots: { index: false, follow: false },
  referrer: "strict-origin-when-cross-origin",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
