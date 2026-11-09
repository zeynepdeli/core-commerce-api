import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { CurrentUser, type RequestUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { clientIp } from '../common/client-ip.js';

import { ListUsersQueryDto, SetActiveDto, SetRoleDto } from './admin-users.dto.js';
import { AdminUsersService } from './admin-users.service.js';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(@Query() query: ListUsersQueryDto) {
    return this.users.list(query);
  }

  @Patch(':id/active')
  setActive(@CurrentUser() actor: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetActiveDto, @Req() req: Request) {
    return this.users.setActive(actor, id, dto.isActive, clientIp(req).ip);
  }

  @Post(':id/unlock')
  @HttpCode(HttpStatus.OK)
  unlock(@CurrentUser() actor: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.users.unlock(actor, id, clientIp(req).ip);
  }

  @Patch(':id/role')
  @Roles('SUPER_ADMIN')
  setRole(@CurrentUser() actor: RequestUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetRoleDto, @Req() req: Request) {
    return this.users.setRole(actor, id, dto.role, clientIp(req).ip);
  }
}
