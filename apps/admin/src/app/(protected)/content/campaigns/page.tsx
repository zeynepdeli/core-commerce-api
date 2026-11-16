import Link from "next/link";
import { BadgePercent } from "lucide-react";

import { AreaCard, AreaShell } from "@/components/areas/AreaShell";
import { CampaignManager } from "@/components/content/CampaignManager";
import { getCampaigns } from "@/lib/content";
import { getMediaBaseUrl } from "@/lib/media-base-url";

export default async function CampaignsPage() {
  const items = await getCampaigns();
  return (
    <AreaShell
      icon={BadgePercent}
      title="Kampanyalar"
      description="Mağazanın Kampanyalar sayfasındaki kartlar. Tarih aralığındaki ve yayındaki kampanyalar görünür; sıralamayı oklarla değiştirin."
      back={{ href: "/dashboard", label: "Dashboard" }}
    >
      <AreaCard
        title={`Kampanyalar (${items.length})`}
        hint={
          <>
            Sayfa başlıkları{" "}
            <Link
              href="/content/theme/kampanyalar"
              className="underline underline-offset-2"
            >
              Kampanyalar Sayfası
            </Link>{" "}
            ekranında. Kupon kodları{" "}
            <Link href="/shop/coupons" className="underline underline-offset-2">
              Kuponlar
            </Link>{" "}
            ekranında tanımlanır.
          </>
        }
      >
        <CampaignManager
          key={items.map((i) => `${i.id}${i.isActive}`).join()}
          items={items}
          mediaBaseUrl={getMediaBaseUrl()}
        />
      </AreaCard>
    </AreaShell>
  );
}
