import Link from "next/link";
import { Images } from "lucide-react";

import { AreaShell } from "@/components/areas/AreaShell";
import { MediaLibrary } from "@/components/media/MediaLibrary";
import { getAdminMedia } from "@/lib/media";
import { getMediaBaseUrl } from "@/lib/media-base-url";

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ sayfa?: string }> }) {
  const { sayfa } = await searchParams;
  const page = Math.min(Math.max(Number.parseInt(sayfa ?? "1", 10) || 1, 1), 10000);
  const result = await getAdminMedia(page);

  return (
    <AreaShell
      icon={Images}
      title="Medya Kütüphanesi"
      description={`Ürün, kategori ve temada kullanılan görseller (${result.total} görsel). Kullanımdaki bir görsel silinemez. Yüklenen görseller otomatik küçültülür ve konum bilgisi silinir.`}
    >
      <MediaLibrary files={result.items} mediaBaseUrl={getMediaBaseUrl()} />
      {result.pages > 1 && (
        <nav aria-label="Sayfalar" className="flex items-center justify-between text-sm">
          {result.page > 1 ? <Link href={`/media?sayfa=${result.page - 1}`} className="font-semibold text-(--brand-accent)">← Önceki</Link> : <span />}
          <span className="text-muted-foreground">Sayfa {result.page} / {result.pages}</span>
          {result.page < result.pages ? <Link href={`/media?sayfa=${result.page + 1}`} className="font-semibold text-(--brand-accent)">Sonraki →</Link> : <span />}
        </nav>
      )}
    </AreaShell>
  );
}
