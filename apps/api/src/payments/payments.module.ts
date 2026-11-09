import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { OrdersModule } from '../orders/orders.module.js';

import { IyzicoClient } from './iyzico.client.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';

@Module({ imports: [AuthModule, OrdersModule], controllers: [PaymentsController], providers: [IyzicoClient, PaymentsService], exports: [PaymentsService] })
export class PaymentsModule {}
