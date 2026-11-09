import { Controller, Get, Param, Query } from '@nestjs/common';

import { ParseSlugPipe } from '../common/parse-slug.pipe.js';

import { CategoriesService } from './categories.service.js';
import { PublicProductQueryDto } from './dto/catalog-query.dto.js';
import { ProductsService } from './products.service.js';

/** Herkese açık katalog (yalnızca yayındaki kayıtlar) */
@Controller('shop')
export class ShopController {
  constructor(
    private readonly categories: CategoriesService,
    private readonly products: ProductsService,
  ) {}

  @Get('categories')
  listCategories() {
    return this.categories.findPublic();
  }

  @Get('categories/:slug')
  getCategory(@Param('slug', ParseSlugPipe) slug: string) {
    return this.categories.findPublicBySlug(slug);
  }

  @Get('products')
  listProducts(@Query() query: PublicProductQueryDto) {
    return this.products.findPublic(query);
  }

  @Get('products/:slug')
  getProduct(@Param('slug', ParseSlugPipe) slug: string) {
    return this.products.findPublicBySlug(slug);
  }
}
