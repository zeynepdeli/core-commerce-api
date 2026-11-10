import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { IyzicoModule } from '../iyzico/iyzico.module.js';
import { ReturnsModule } from '../returns/returns.module.js';

import { AdminOrdersService } from './admin-orders.service.js';
import { AccountOrdersController, AdminOrdersController, GuestOrdersController, OrderExpiryJob } from './orders.controller.js';
import { OrderMailService } from './order-mail.service.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [AuthModule, IyzicoModule, ReturnsModule],
  controllers: [AccountOrdersController, GuestOrdersController, AdminOrdersController],
  providers: [OrdersService, AdminOrdersService, OrderExpiryJob, OrderMailService],
  exports: [OrdersService, OrderMailService],
})
export class OrdersModule {}
