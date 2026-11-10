import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put, UseGuards } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { ParseSlugPipe } from '../common/parse-slug.pipe.js';
import { ReorderIdsDto } from '../common/reorder.js';

import { ActiveDto, BLOCK_TYPES, FEATURE_ICONS, FONTS, SOCIAL_HOSTS, SaveBlockDto, SaveFaqDto, SavePageDto, UpdateSiteDto } from './content.dto.js';
import { ContentService } from './content.service.js';

/** Mağaza (herkese açık) */
@Controller('shop')
export class ShopContentController {
  constructor(private readonly content: ContentService) {}

  @Get('site')
  site() {
    return this.content.site();
  }

  @Get('home')
  home() {
    return this.content.home();
  }

  @Get('pages/:slug')
  page(@Param('slug', ParseSlugPipe) slug: string) {
    return this.content.page(slug);
  }

  @Get('faq')
  faq() {
    return this.content.faq();
  }
}

@Controller('admin/content')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminContentController {
  constructor(private readonly content: ContentService) {}

  /** Formlar için seçenekler */
  @Get('options')
  options() {
    return { fonts: FONTS, blockTypes: BLOCK_TYPES, featureIcons: FEATURE_ICONS, socialNetworks: Object.keys(SOCIAL_HOSTS) };
  }

  @Get('site')
  site() {
    return this.content.adminSite();
  }

  @Put('site')
  updateSite(@Body() dto: UpdateSiteDto) {
    return this.content.updateSite(dto);
  }

  // Ana sayfa bölümleri
  @Get('home')
  blocks() {
    return this.content.adminBlocks();
  }

  @Get('home/:id')
  block(@Param('id', ParseUUIDPipe) id: string) {
    return this.content.adminBlock(id);
  }

  @Post('home')
  createBlock(@Body() dto: SaveBlockDto) {
    return this.content.createBlock(dto);
  }

  @Put('home/reorder')
  reorderBlocks(@Body() dto: ReorderIdsDto) {
    return this.content.reorderBlocks(dto.ids);
  }

  @Put('home/:id')
  updateBlock(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveBlockDto) {
    return this.content.updateBlock(id, dto);
  }

  @Patch('home/:id/active')
  setActive(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActiveDto) {
    return this.content.setBlockActive(id, dto.isActive);
  }

  @Delete('home/:id')
  @HttpCode(HttpStatus.OK)
  deleteBlock(@Param('id', ParseUUIDPipe) id: string) {
    return this.content.deleteBlock(id);
  }

  // Sayfalar
  @Get('pages')
  pages() {
    return this.content.adminPages();
  }

  @Put('pages/reorder')
  reorderPages(@Body() dto: ReorderIdsDto) {
    return this.content.reorderPages(dto.ids);
  }

  @Get('pages/:id')
  pageById(@Param('id', ParseUUIDPipe) id: string) {
    return this.content.adminPage(id);
  }

  @Post('pages')
  createPage(@Body() dto: SavePageDto) {
    return this.content.savePage(null, dto);
  }

  @Put('pages/:id')
  updatePage(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SavePageDto) {
    return this.content.savePage(id, dto);
  }

  @Delete('pages/:id')
  @HttpCode(HttpStatus.OK)
  deletePage(@Param('id', ParseUUIDPipe) id: string) {
    return this.content.deletePage(id);
  }

  // S.S.S.
  @Get('faq')
  faq() {
    return this.content.adminFaq();
  }

  @Put('faq/reorder')
  reorderFaq(@Body() dto: ReorderIdsDto) {
    return this.content.reorderFaq(dto.ids);
  }

  @Post('faq')
  createFaq(@Body() dto: SaveFaqDto) {
    return this.content.saveFaq(null, dto);
  }

  @Put('faq/:id')
  updateFaq(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveFaqDto) {
    return this.content.saveFaq(id, dto);
  }

  @Delete('faq/:id')
  @HttpCode(HttpStatus.OK)
  deleteFaq(@Param('id', ParseUUIDPipe) id: string) {
    return this.content.deleteFaq(id);
  }
}
