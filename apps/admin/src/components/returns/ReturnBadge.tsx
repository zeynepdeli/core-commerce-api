import { RETURN_LABEL, RETURN_TONE, type ReturnStatus } from "@/lib/returns";

export function ReturnBadge({ status }: { status: ReturnStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${RETURN_TONE[status]}`}>{RETURN_LABEL[status]}</span>;
}
