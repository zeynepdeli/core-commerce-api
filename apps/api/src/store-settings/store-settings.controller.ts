import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';

import { UpdateStoreSettingsDto } from './store-settings.dto.js';
import { StoreSettingsService } from './store-settings.service.js';

/** Mağaza: "X ₺ daha ekleyin, kargo bedava" gibi bilgiler için */
@Controller('shop/settings')
export class PublicStoreSettingsController {
  constructor(private readonly settings: StoreSettingsService) {}

  @Get()
  get() {
    return this.settings.view();
  }
}

@Controller('admin/store-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminStoreSettingsController {
  constructor(private readonly settings: StoreSettingsService) {}

  @Get()
  get() {
    return this.settings.adminView();
  }

  @Put()
  update(@Body() dto: UpdateStoreSettingsDto) {
    return this.settings.update(dto);
  }
}
