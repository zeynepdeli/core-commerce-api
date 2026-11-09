import { PackagePlus } from "lucide-react";

import { AreaShell } from "@/components/areas/AreaShell";
import { ProductForm } from "@/components/shop/ProductForm";
import { getMediaBaseUrl } from "@/lib/media-base-url";
import { getAdminCategories } from "@/lib/shop";

export default async function NewProductPage() {
  const categories = await getAdminCategories();
  return (
    <AreaShell
      icon={PackagePlus}
      title="Yeni Ürün"
      description="Ürün bilgilerini girin; kaydettikten sonra düzenlemeye devam edebilirsiniz."
      back={{ href: "/shop/products", label: "Ürün Yönetimi" }}
    >
      <ProductForm categories={categories.map(({ id, name }) => ({ id, name }))} mediaBaseUrl={getMediaBaseUrl()} />
    </AreaShell>
  );
}
