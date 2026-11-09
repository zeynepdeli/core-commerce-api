import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';

import { AdminCatalogController } from './admin-catalog.controller.js';
import { CategoriesService } from './categories.service.js';
import { ProductsService } from './products.service.js';
import { ShopController } from './shop.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [ShopController, AdminCatalogController],
  providers: [CategoriesService, ProductsService],
  exports: [CategoriesService, ProductsService],
})
export class CatalogModule {}
