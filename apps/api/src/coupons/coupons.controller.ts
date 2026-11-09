import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';

import { CreateCouponDto, ListCouponsQueryDto, UpdateCouponDto } from './coupons.dto.js';
import { CouponsService } from './coupons.service.js';

@Controller('admin/coupons')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminCouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Get()
  list(@Query() query: ListCouponsQueryDto) {
    return this.coupons.list(query);
  }

  @Post()
  create(@Body() dto: CreateCouponDto) {
    return this.coupons.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCouponDto) {
    return this.coupons.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.coupons.remove(id);
  }
}
