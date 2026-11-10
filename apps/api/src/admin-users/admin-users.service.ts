import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service.js';
import type { RequestUser } from '../auth/decorators/current-user.decorator.js';
import { TokensService } from '../auth/tokens.service.js';
import type { Prisma, Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

import type { ListUsersQueryDto } from './admin-users.dto.js';

// Admin listesinde bile şifre özeti, Google kimliği vb. gösterilmez
const LIST_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  signupMethod: true,
  emailVerifiedAt: true,
  isActive: true,
  deletedAt: true,
  lockedUntil: true,
  failedLoginCount: true,
  twoFactorEnabledAt: true,
  createdAt: true,
} as const;

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const now = new Date();
    const status: Prisma.UserWhereInput =
      query.status === 'active'
        ? { isActive: true, deletedAt: null }
        : query.status === 'inactive'
          ? { isActive: false, deletedAt: null }
          : query.status === 'locked'
            ? { lockedUntil: { gt: now } }
            : query.status === 'deleted'
              ? { deletedAt: { not: null } }
              : {};
    const where: Prisma.UserWhereInput = {
      AND: [
        query.q
          ? { OR: [{ email: { contains: query.q, mode: 'insensitive' } }, { name: { contains: query.q, mode: 'insensitive' } }] }
          : {},
        query.role ? { role: query.role } : {},
        status,
      ],
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({ where, select: LIST_SELECT, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit }),
    ]);
    return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
  }

  /** Askıya alma / geri açma. Askıya alınan kullanıcının tüm oturumları kapanır. */
  async setActive(actor: RequestUser, id: string, isActive: boolean, ip?: string) {
    const target = await this.findTarget(actor, id);
    if (target.role !== 'CUSTOMER' && actor.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Yönetici hesaplarını yalnızca süper yönetici değiştirebilir.');
    }
    await this.prisma.user.update({ where: { id }, data: { isActive } });
    if (!isActive) await this.tokens.revokeAllForUser(id);
    await this.audit.log({ action: isActive ? 'admin.user_activated' : 'admin.user_deactivated', entity: 'User', entityId: id, userId: actor.id, ipAddress: ip });
    return { success: true };
  }

  async unlock(actor: RequestUser, id: string, ip?: string) {
    await this.findTarget(actor, id);
    await this.prisma.user.update({ where: { id }, data: { lockedUntil: null, failedLoginCount: 0 } });
    await this.audit.log({ action: 'admin.user_unlocked', entity: 'User', entityId: id, userId: actor.id, ipAddress: ip });
    return { success: true };
  }

  /** Rol değişikliği: yalnızca SUPER_ADMIN (controller'da), kendine uygulanamaz, son süper yönetici düşürülemez */
  async setRole(actor: RequestUser, id: string, role: Role, ip?: string) {
    const target = await this.findTarget(actor, id);
    if (target.role === role) return { success: true };
    if (target.role === 'SUPER_ADMIN') {
      const supers = await this.prisma.user.count({ where: { role: 'SUPER_ADMIN', isActive: true, deletedAt: null } });
      if (supers <= 1) throw new BadRequestException('Son süper yöneticinin rolü değiştirilemez.');
    }
    await this.prisma.user.update({ where: { id }, data: { role } });
    // Yeni rol bir sonraki istekte geçerli olur (guard rolü veritabanından okur); yine de oturumları kapat
    await this.tokens.revokeAllForUser(id);
    await this.audit.log({
      action: 'admin.user_role_changed',
      entity: 'User',
      entityId: id,
      userId: actor.id,
      ipAddress: ip,
      metaData: { from: target.role, to: role },
    });
    return { success: true };
  }

  private async findTarget(actor: RequestUser, id: string) {
    if (actor.id === id) throw new BadRequestException('Bu işlemi kendi hesabınıza uygulayamazsınız.');
    const target = await this.prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!target) throw new NotFoundException('Kullanıcı bulunamadı.');
    return target;
  }
}
