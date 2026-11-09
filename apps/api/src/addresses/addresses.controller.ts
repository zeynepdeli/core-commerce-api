import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';

import { CurrentUser, type RequestUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

import { CreateAddressDto } from './addresses.dto.js';
import { AddressesService } from './addresses.service.js';

@Controller('account/addresses')
@UseGuards(JwtAuthGuard)
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.addresses.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateAddressDto) {
    return this.addresses.create(user.id, dto);
  }

  @Put(':id')
  update(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateAddressDto) {
    return this.addresses.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.addresses.remove(user.id, id);
  }
}
