import Link from "next/link";
import { FileText, Plus } from "lucide-react";

import { AreaCard, AreaShell } from "@/components/areas/AreaShell";
import { PageList } from "@/components/content/PageList";
import { getPages } from "@/lib/content";

export default async function PagesPage() {
  const pages = await getPages();
  return (
    <AreaShell
      icon={FileText}
      title="Sayfalar"
      description="Hakkımızda, Teslimat, İletişim gibi bilgi sayfaları. Sıralama alt bilgideki sırayı belirler. (Yasal metinler Satış Ayarları → Yasal Metinler'de.)"
      back={{ href: "/dashboard", label: "Dashboard" }}
      actions={
        <Link href="/content/pages/new" className="inline-flex items-center gap-2 rounded-full bg-(--brand-primary) px-5 py-2.5 text-xs font-bold text-white">
          <Plus className="size-4" /> Yeni Sayfa
        </Link>
      }
    >
      <AreaCard title={`Sayfalar (${pages.length})`}>
        <PageList rows={pages} />
      </AreaCard>
    </AreaShell>
  );
}
