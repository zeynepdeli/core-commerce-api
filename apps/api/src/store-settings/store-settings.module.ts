import { Global, Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';

import { AdminStoreSettingsController, PublicStoreSettingsController } from './store-settings.controller.js';
import { StoreSettingsService } from './store-settings.service.js';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [PublicStoreSettingsController, AdminStoreSettingsController],
  providers: [StoreSettingsService],
  exports: [StoreSettingsService],
})
export class StoreSettingsModule {}
