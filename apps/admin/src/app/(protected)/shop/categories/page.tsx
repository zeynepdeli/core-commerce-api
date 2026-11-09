import { FolderTree } from "lucide-react";

import { AreaCard, AreaShell } from "@/components/areas/AreaShell";
import { CategoryManager } from "@/components/shop/CategoryManager";
import { getMediaBaseUrl } from "@/lib/media-base-url";
import { getAdminCategories, toCategoryFormValues } from "@/lib/shop";

export default async function CategoriesPage() {
  const categories = await getAdminCategories();
  return (
    <AreaShell
      icon={FolderTree}
      title="Kategori Yönetimi"
      description="Ürünlerin gruplandığı kategoriler. Sıralama sitede menü ve filtrelerde de kullanılır."
    >
      <AreaCard title="Kategoriler" hint="Okları kullanarak sıralayın.">
        <CategoryManager
          mediaBaseUrl={getMediaBaseUrl()}
          categories={categories.map((c) => ({ ...toCategoryFormValues(c), id: c.id, productCount: c.productCount }))}
        />
      </AreaCard>
    </AreaShell>
  );
}
