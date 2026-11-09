import { Store } from "lucide-react";

import { AreaShell } from "@/components/areas/AreaShell";
import { StoreInfoForm } from "@/components/store/StoreInfoForm";
import { getStoreSettings } from "@/lib/store";

export default async function StoreInfoPage() {
  const s = await getStoreSettings();
  return (
    <AreaShell icon={Store} title="Mağaza Bilgileri" description="Satıcı bilgileri (yasal metinlerde) ve ödeme süresi.">
      <StoreInfoForm
        initial={{
          sellerName: s.sellerName ?? "",
          sellerEmail: s.sellerEmail ?? "",
          sellerPhone: s.sellerPhone ?? "",
          sellerTaxOffice: s.sellerTaxOffice ?? "",
          sellerTaxNumber: s.sellerTaxNumber ?? "",
          sellerMersisNo: s.sellerMersisNo ?? "",
          sellerAddress: s.sellerAddress ?? "",
          paymentTimeoutMinutes: String(s.paymentTimeoutMinutes),
        }}
      />
    </AreaShell>
  );
}
