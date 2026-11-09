import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { ReorderIdsDto } from '../common/reorder.js';

import { CategoriesService } from './categories.service.js';
import { AdminProductQueryDto } from './dto/catalog-query.dto.js';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto.js';
import { ProductsService } from './products.service.js';

@Controller('admin/shop')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminCatalogController {
  constructor(
    private readonly categories: CategoriesService,
    private readonly products: ProductsService,
  ) {}

  // ───── Kategoriler ─────
  @Get('categories')
  listCategories() {
    return this.categories.findAll();
  }

  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  // ':id' rotasından ÖNCE
  @Patch('categories/reorder')
  reorderCategories(@Body() dto: ReorderIdsDto) {
    return this.categories.reorder(dto.ids);
  }

  @Patch('categories/:id')
  updateCategory(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Delete('categories/:id')
  removeCategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.categories.remove(id);
  }

  // ───── Ürünler ─────
  @Get('products')
  listProducts(@Query() query: AdminProductQueryDto) {
    return this.products.findAll(query);
  }

  @Get('products/:id')
  getProduct(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.findOne(id);
  }

  @Post('products')
  createProduct(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Patch('products/:id')
  updateProduct(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  @Delete('products/:id')
  removeProduct(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.remove(id);
  }
}
