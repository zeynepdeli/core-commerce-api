import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';

import { AdminOrdersService } from './admin-orders.service.js';
import { AccountOrdersController, AdminOrdersController, GuestOrdersController, OrderExpiryJob } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AccountOrdersController, GuestOrdersController, AdminOrdersController],
  providers: [OrdersService, AdminOrdersService, OrderExpiryJob],
  exports: [OrdersService],
})
export class OrdersModule {}
