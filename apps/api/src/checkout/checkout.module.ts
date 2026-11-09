import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { CartModule } from '../cart/cart.module.js';
import { LegalModule } from '../legal/legal.module.js';
import { OrdersModule } from '../orders/orders.module.js';

import { CheckoutController } from './checkout.controller.js';
import { CheckoutService } from './checkout.service.js';

@Module({ imports: [AuthModule, CartModule, LegalModule, OrdersModule], controllers: [CheckoutController], providers: [CheckoutService] })
export class CheckoutModule {}
