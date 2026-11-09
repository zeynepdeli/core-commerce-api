import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { CouponsModule } from '../coupons/coupons.module.js';

import { CartController } from './cart.controller.js';
import { CartService } from './cart.service.js';

@Module({ imports: [AuthModule, CouponsModule], controllers: [CartController], providers: [CartService], exports: [CartService] })
export class CartModule {}
