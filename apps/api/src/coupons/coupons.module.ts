import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';

import { AdminCouponsController } from './coupons.controller.js';
import { CouponsService } from './coupons.service.js';

@Module({ imports: [AuthModule], controllers: [AdminCouponsController], providers: [CouponsService], exports: [CouponsService] })
export class CouponsModule {}
