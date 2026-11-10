import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';

import { FavoritesService } from './favorites.service.js';
import { AccountReviewsController, AdminReviewsController, ShopReviewsController } from './reviews.controller.js';
import { ReviewsService } from './reviews.service.js';

@Module({ imports: [AuthModule], controllers: [ShopReviewsController, AccountReviewsController, AdminReviewsController], providers: [ReviewsService, FavoritesService] })
export class ReviewsModule {}
