import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { IyzicoModule } from '../iyzico/iyzico.module.js';
import { OrdersModule } from '../orders/orders.module.js';

import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';

@Module({ imports: [AuthModule, OrdersModule, IyzicoModule], controllers: [PaymentsController], providers: [PaymentsService], exports: [PaymentsService] })
export class PaymentsModule {}
