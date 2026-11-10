import { NextResponse, type NextRequest } from "next/server";

import { ApiError, adminFetch } from "@/lib/api";
import { DATE_RE } from "@/lib/reports";

/** Muhasebe CSV'si: API'den alınır (yönetici çerezi sunucuda kalır), indirilir */
export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from") ?? "";
  const to = request.nextUrl.searchParams.get("to") ?? "";
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return new NextResponse("Tarih geçersiz.", { status: 400 });
  try {
    const response = await adminFetch(`/admin/reports/sales.csv?${new URLSearchParams({ from, to })}`);
    if (!response.ok) return new NextResponse(response.status === 400 ? "Aralık geçersiz veya çok fazla sipariş var." : "İndirilemedi.", { status: response.status });
    return new NextResponse(await response.arrayBuffer(), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="satislar_${from}_${to}.csv"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return new NextResponse(error instanceof ApiError ? error.message : "İndirilemedi.", { status: error instanceof ApiError ? error.status : 500 });
  }
}
