import type { Prisma } from '../generated/prisma/client.js';

type Db = Pick<Prisma.TransactionClient, '$executeRaw'>;

/** Ürünlerin onaylı yorum özetini yeniden hesaplar (tek SQL, onay/silme/hesap kapatma sonrası) */
export async function recomputeRatings(db: Db, productIds: string[]) {
  if (!productIds.length) return;
  await db.$executeRaw`
    UPDATE "Product" p SET
      "ratingCount" = coalesce(s.n, 0),
      "ratingAvg" = coalesce(s.avg, 0)
    FROM (SELECT unnest(${productIds}::text[]) AS id) ids
    LEFT JOIN (
      SELECT r."productId", count(*)::int AS n, round(avg(r.rating)::numeric, 2) AS avg
      FROM "Review" r JOIN "User" u ON u.id = r."userId"
      WHERE r.status = 'APPROVED' AND r."productId" = ANY(${productIds}::text[]) AND u."deletedAt" IS NULL
      GROUP BY r."productId"
    ) s ON s."productId" = ids.id
    WHERE p.id = ids.id`;
}
