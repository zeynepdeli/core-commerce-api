import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { CurrentUser, type RequestUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { clientIp } from '../common/client-ip.js';
import { ParseSlugPipe } from '../common/parse-slug.pipe.js';
import { PrismaService } from '../prisma/prisma.service.js';

import { FavoritesService } from './favorites.service.js';
import { AdminReviewsQueryDto, CreateReviewDto, ModerateReviewDto, PublicReviewsQueryDto, ReplyReviewDto, ReviewBodyDto } from './reviews.dto.js';
import { ReviewsService } from './reviews.service.js';

@Controller('shop/products/:slug/reviews')
export class ShopReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  list(@Param('slug', ParseSlugPipe) slug: string, @Query() query: PublicReviewsQueryDto) {
    return this.reviews.listForProduct(slug, query);
  }
}

@Controller('account')
@UseGuards(JwtAuthGuard)
export class AccountReviewsController {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly favorites: FavoritesService,
  ) {}

  @Get('reviews')
  mine(@CurrentUser() user: RequestUser) {
    return this.reviews.mine(user.id);
  }

  @Get('reviews/eligible')
  eligible(@CurrentUser() user: RequestUser) {
    return this.reviews.eligible(user.id);
  }

  @Post('reviews')
  @Throttle({ default: { limit: 5, ttl: 60_000 }, long: { limit: 30, ttl: 3_600_000 } })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateReviewDto) {
    const { productId, ...body } = dto;
    return this.reviews.create(user.id, productId, body);
  }

  @Patch('reviews/:id')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  update(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewBodyDto) {
    return this.reviews.update(user.id, id, dto);
  }

  @Delete('reviews/:id')
  remove(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.reviews.remove(user.id, id);
  }

  // ───── Favoriler ─────

  @Get('favorites')
  favoritesList(@CurrentUser() user: RequestUser, @Query('page') page?: string) {
    const p = Math.min(Math.max(Number.parseInt(page ?? '1', 10) || 1, 1), 1000);
    return this.favorites.list(user.id, p);
  }

  @Get('favorites/ids')
  favoriteIds(@CurrentUser() user: RequestUser) {
    return this.favorites.ids(user.id);
  }

  @Put('favorites/:productId')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  addFavorite(@CurrentUser() user: RequestUser, @Param('productId', ParseUUIDPipe) productId: string) {
    return this.favorites.add(user.id, productId);
  }

  @Delete('favorites/:productId')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  removeFavorite(@CurrentUser() user: RequestUser, @Param('productId', ParseUUIDPipe) productId: string) {
    return this.favorites.remove(user.id, productId);
  }
}

@Controller('admin/reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminReviewsController {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  list(@Query() query: AdminReviewsQueryDto) {
    return this.reviews.adminList(query);
  }

  /** En çok favorilenen ürünler */
  @Get('favorites')
  async topFavorites() {
    const rows = await this.prisma.like.groupBy({ by: ['productId'], _count: { _all: true }, orderBy: { _count: { productId: 'desc' } }, take: 10 });
    const products = await this.prisma.product.findMany({ where: { id: { in: rows.map((r) => r.productId) } }, select: { id: true, name: true } });
    const name = new Map(products.map((p) => [p.id, p.name]));
    return rows.map((r) => ({ productId: r.productId, name: name.get(r.productId) ?? '', count: r._count._all }));
  }

  @Patch(':id')
  moderate(@CurrentUser() actor: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ModerateReviewDto, @Req() req: Request) {
    return this.reviews.moderate(id, dto, actor.id, clientIp(req).ip);
  }

  @Put(':id/reply')
  reply(@CurrentUser() actor: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReplyReviewDto) {
    return this.reviews.reply(id, dto.reply, actor.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() actor: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.reviews.adminDelete(id, actor.id, clientIp(req).ip);
  }
}
