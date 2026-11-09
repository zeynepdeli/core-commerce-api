import { Truck } from "lucide-react";

import { AreaShell } from "@/components/areas/AreaShell";
import { ShippingForm } from "@/components/store/ShippingForm";
import { getStoreSettings } from "@/lib/store";

const input = (v: string | null) => (v === null ? "" : v.replace(/\.00$/, "").replace(".", ","));

export default async function ShippingPage() {
  const s = await getStoreSettings();
  return (
    <AreaShell icon={Truck} title="Kargo Ayarları" description="Kargo ücreti, ücretsiz kargo eşiği ve en düşük sipariş tutarı.">
      <ShippingForm
        initial={{ shippingFee: input(s.shippingFee), freeShippingThreshold: input(s.freeShippingThreshold), minOrderAmount: input(s.minOrderAmount) }}
      />
    </AreaShell>
  );
}
