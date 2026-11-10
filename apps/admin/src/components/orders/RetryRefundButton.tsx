"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { retryOrderRefundAction } from "@/app/actions/returns";
import { Button } from "@/components/ui/button";

export function RetryRefundButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await retryOrderRefundAction(orderId);
            if (!r.success) return setError(r.error);
            router.refresh();
          })
        }
        className="gap-2"
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        İadeyi iyzico ile yap
      </Button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
