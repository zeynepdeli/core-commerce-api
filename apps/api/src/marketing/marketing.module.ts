import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';

import { CartRemindersService } from './cart-reminders.service.js';
import { ConsentsService } from './consents.service.js';
import { AccountConsentsController, AdminMarketingController, MarketingController } from './marketing.controller.js';
import { ProductFeedService } from './product-feed.service.js';
import { StockAlertsService } from './stock-alerts.service.js';

@Module({
  imports: [AuthModule],
  controllers: [MarketingController, AccountConsentsController, AdminMarketingController],
  providers: [ConsentsService, StockAlertsService, CartRemindersService, ProductFeedService],
  exports: [ConsentsService],
})
export class MarketingModule {}
