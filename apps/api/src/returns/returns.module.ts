import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { IyzicoModule } from '../iyzico/iyzico.module.js';

import { ReturnMailService } from './return-mail.service.js';
import { AccountReturnsController, AdminReturnsController, GuestReturnsController } from './returns.controller.js';
import { ReturnsService } from './returns.service.js';

@Module({
  imports: [AuthModule, IyzicoModule],
  controllers: [AccountReturnsController, GuestReturnsController, AdminReturnsController],
  providers: [ReturnsService, ReturnMailService],
  exports: [ReturnsService],
})
export class ReturnsModule {}
