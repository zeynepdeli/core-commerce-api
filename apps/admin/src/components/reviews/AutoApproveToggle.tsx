"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { setReviewAutoApproveAction } from "@/app/actions/reviews";
import { Switch } from "@/components/ui/switch";

export function AutoApproveToggle({ on }: { on: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="flex items-start justify-between gap-4">
      <span>
        <span className="block font-medium">Onay beklemeden yayınla</span>
        <span className="block text-sm text-muted-foreground">Kapalıyken her yorum (ve düzenlenen yorum) siz onaylayınca yayınlanır. Yalnızca ürünü satın almış ve kargosu çıkmış üyeler yorum yazabilir.</span>
      </span>
      <Switch
        checked={on}
        disabled={pending}
        aria-label="Onay beklemeden yayınla"
        onCheckedChange={(v) =>
          start(async () => {
            await setReviewAutoApproveAction(v);
            router.refresh();
          })
        }
      />
    </label>
  );
}
