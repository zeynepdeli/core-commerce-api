import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service.js';
import type { Prisma, ReviewStatus } from '../generated/prisma/client.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StoreSettingsService } from '../store-settings/store-settings.service.js';

import { recomputeRatings } from './ratings.js';
import type { AdminReviewsQueryDto, ModerateReviewDto, PublicReviewsQueryDto, ReviewBodyDto } from './reviews.dto.js';

const PAGE = 10;
const ADMIN_PAGE = 30;
/** Ürün mağazada görünür mü */
const VISIBLE_PRODUCT: Prisma.ProductWhereInput = { isActive: true, deletedAt: null, category: { isActive: true, deletedAt: null } };

/** "Ayşe Nur Yılmaz" → "Ayşe Y." (yorumda tam ad gösterilmez: kişisel veri en aza) */
export function maskName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Müşteri';
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts.at(-1)?.[0]?.toLocaleUpperCase('tr-TR')}.`;
}

/**
 * Ürün yorumları. Yalnızca ürünü SATIN ALMIŞ (kargolanmış/teslim edilmiş siparişi olan)
 * üyeler yorum yapabilir: sahte yorum ve rakip saldırısı zorlaşır, "Doğrulanmış alıcı"
 * rozeti anlamlıdır. Yorumlar varsayılan olarak onaydan sonra yayınlanır; düzenlenen yorum
 * tekrar onaya düşer. Metin düz metindir (HTML yorumlanmaz).
 */
@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: StoreSettingsService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {}

  // ───────────── Mağaza ─────────────

  async listForProduct(slug: string, query: PublicReviewsQueryDto) {
    const product = await this.prisma.product.findFirst({ where: { ...VISIBLE_PRODUCT, slug }, select: { id: true, ratingAvg: true, ratingCount: true } });
    if (!product) throw new NotFoundException('Ürün bulunamadı.');
    const page = query.page ?? 1;
    const base: Prisma.ReviewWhereInput = { productId: product.id, status: 'APPROVED', user: { deletedAt: null } };
    const where: Prisma.ReviewWhereInput = { ...base, ...(query.rating ? { rating: query.rating } : {}) };
    const orderBy: Prisma.ReviewOrderByWithRelationInput[] =
      query.sort === 'rating-high' ? [{ rating: 'desc' }, { createdAt: 'desc' }] : query.sort === 'rating-low' ? [{ rating: 'asc' }, { createdAt: 'desc' }] : [{ createdAt: 'desc' }];
    const [total, rows, dist] = await this.prisma.$transaction([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        orderBy: [...orderBy, { id: 'asc' }],
        skip: (page - 1) * PAGE,
        take: PAGE,
        select: { id: true, rating: true, title: true, comment: true, orderId: true, adminReply: true, adminReplyAt: true, createdAt: true, user: { select: { name: true } } },
      }),
      this.prisma.review.groupBy({ by: ['rating'], where: base, orderBy: { rating: 'asc' }, _count: { _all: true } }),
    ]);
    const distribution = Object.fromEntries([1, 2, 3, 4, 5].map((r) => [r, (dist.find((d) => d.rating === r)?._count as { _all: number } | undefined)?._all ?? 0]));
    return {
      summary: { average: Number(product.ratingAvg), count: product.ratingCount, distribution },
      items: rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        comment: r.comment,
        author: maskName(r.user.name),
        verifiedPurchase: !!r.orderId,
        reply: r.adminReply ? { text: r.adminReply, at: r.adminReplyAt } : null,
        createdAt: r.createdAt,
      })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE)),
    };
  }

  // ───────────── Üye ─────────────

  /** Ürünün kargolanmış/teslim edilmiş bir siparişi (yoksa yorum yapılamaz) */
  private purchase(userId: string, productId: string) {
    return this.prisma.order.findFirst({
      where: { userId, status: { in: ['SHIPPED', 'DELIVERED'] }, items: { some: { productId } } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
  }

  /** Satın alınmış ama henüz yorumlanmamış ürünler ("Değerlendirin" listesi) */
  async eligible(userId: string) {
    const rows = await this.prisma.orderItem.findMany({
      where: { order: { userId, status: { in: ['SHIPPED', 'DELIVERED'] } }, product: { ...VISIBLE_PRODUCT, reviews: { none: { userId } } } },
      distinct: ['productId'],
      orderBy: { order: { createdAt: 'desc' } },
      take: 50,
      select: { product: { select: { id: true, name: true, slug: true, images: { orderBy: { order: 'asc' }, take: 1, select: { url: true, alt: true } } } } },
    });
    return rows.map((r) => ({ productId: r.product.id, name: r.product.name, slug: r.product.slug, image: r.product.images[0] ?? null }));
  }

  async mine(userId: string) {
    const rows = await this.prisma.review.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { product: { select: { name: true, slug: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      product: r.product,
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      status: r.status,
      rejectReason: r.status === 'REJECTED' ? r.rejectReason : null,
      reply: r.adminReply,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async create(userId: string, productId: string, dto: ReviewBodyDto) {
    const product = await this.prisma.product.findFirst({ where: { ...VISIBLE_PRODUCT, id: productId }, select: { id: true } });
    if (!product) throw new NotFoundException('Ürün bulunamadı.');
    const order = await this.purchase(userId, productId);
    if (!order) throw new ForbiddenException('Yalnızca satın aldığınız ve size gönderilmiş ürünleri değerlendirebilirsiniz.');
    const status = await this.initialStatus();
    try {
      const review = await this.prisma.review.create({
        data: { userId, productId, orderId: order.id, rating: dto.rating, title: dto.title || null, comment: dto.comment, status },
      });
      if (status === 'APPROVED') await recomputeRatings(this.prisma, [productId]);
      return { id: review.id, status, message: status === 'APPROVED' ? 'Yorumunuz yayınlandı. Teşekkürler!' : 'Teşekkürler! Yorumunuz onaylandıktan sonra yayınlanacak.' };
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Bu ürünü zaten değerlendirdiniz; yorumunuzu düzenleyebilirsiniz.');
      throw error;
    }
  }

  /** Düzenlenen yorum (otomatik onay kapalıysa) yeniden onaya düşer; mağaza yanıtı kalır */
  async update(userId: string, id: string, dto: ReviewBodyDto) {
    const review = await this.prisma.review.findFirst({ where: { id, userId } });
    if (!review) throw new NotFoundException('Yorum bulunamadı.');
    const status = await this.initialStatus();
    await this.prisma.review.update({
      where: { id },
      data: { rating: dto.rating, title: dto.title || null, comment: dto.comment, status, rejectReason: null },
    });
    await recomputeRatings(this.prisma, [review.productId]);
    return { id, status };
  }

  async remove(userId: string, id: string) {
    const review = await this.prisma.review.findFirst({ where: { id, userId }, select: { productId: true } });
    if (!review) throw new NotFoundException('Yorum bulunamadı.');
    await this.prisma.review.delete({ where: { id } });
    await recomputeRatings(this.prisma, [review.productId]);
    return { success: true };
  }

  private async initialStatus(): Promise<ReviewStatus> {
    return (await this.settings.seller()).reviewAutoApprove ? 'APPROVED' : 'PENDING';
  }

  // ───────────── Yönetici ─────────────

  async adminList(query: AdminReviewsQueryDto) {
    const page = query.page ?? 1;
    const q = query.q;
    const where: Prisma.ReviewWhereInput = {
      AND: [
        query.status ? { status: query.status } : {},
        q ? { OR: [{ comment: { contains: q, mode: 'insensitive' } }, { product: { name: { contains: q, mode: 'insensitive' } } }, { user: { email: { contains: q.toLowerCase() } } }] } : {},
      ],
    };
    const [total, rows, counts] = await this.prisma.$transaction([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * ADMIN_PAGE,
        take: ADMIN_PAGE,
        include: { product: { select: { id: true, name: true, slug: true } }, user: { select: { name: true, email: true, deletedAt: true } } },
      }),
      this.prisma.review.groupBy({ by: ['status'], orderBy: { status: 'asc' }, _count: { _all: true } }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        status: r.status,
        rating: r.rating,
        title: r.title,
        comment: r.comment,
        verifiedPurchase: !!r.orderId,
        orderId: r.orderId,
        rejectReason: r.rejectReason,
        reply: r.adminReply,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        product: r.product,
        author: { name: r.user.name, email: r.user.email, deleted: !!r.user.deletedAt },
      })),
      counts: Object.fromEntries(counts.map((c) => [c.status, (c._count as { _all: number })._all])),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / ADMIN_PAGE)),
    };
  }

  async moderate(id: string, dto: ModerateReviewDto, actorId: string, ip?: string) {
    const review = await this.prisma.review.findUnique({ where: { id }, include: { user: { select: { email: true, name: true } }, product: { select: { name: true } } } });
    if (!review) throw new NotFoundException('Yorum bulunamadı.');
    await this.prisma.review.update({ where: { id }, data: { status: dto.status, rejectReason: dto.status === 'REJECTED' ? dto.rejectReason || null : null } });
    await recomputeRatings(this.prisma, [review.productId]);
    await this.audit.log({ action: `admin.review_${dto.status.toLowerCase()}`, entity: 'Review', entityId: id, userId: actorId, ipAddress: ip });
    if (dto.status === 'REJECTED' && review.status !== 'REJECTED') {
      this.mail.sendInBackground({
        to: review.user.email,
        subject: 'Yorumunuz hakkında',
        text: `Merhaba ${review.user.name},\n\n"${review.product.name}" için yazdığınız yorum yayınlanamadı.${dto.rejectReason ? `\nNeden: ${dto.rejectReason}` : ''}\n\nYorumunuzu hesabınızdan düzenleyip tekrar gönderebilirsiniz.`,
      });
    }
    return { id, status: dto.status };
  }

  async reply(id: string, text: string, actorId: string) {
    const { count } = await this.prisma.review.updateMany({ where: { id }, data: { adminReply: text || null, adminReplyAt: text ? new Date() : null } });
    if (count === 0) throw new NotFoundException('Yorum bulunamadı.');
    await this.audit.log({ action: 'admin.review_reply', entity: 'Review', entityId: id, userId: actorId });
    return { id, reply: text || null };
  }

  async adminDelete(id: string, actorId: string, ip?: string) {
    const review = await this.prisma.review.findUnique({ where: { id }, select: { productId: true } });
    if (!review) throw new NotFoundException('Yorum bulunamadı.');
    await this.prisma.review.delete({ where: { id } });
    await recomputeRatings(this.prisma, [review.productId]);
    await this.audit.log({ action: 'admin.review_deleted', entity: 'Review', entityId: id, userId: actorId, ipAddress: ip });
    return { success: true };
  }
}
