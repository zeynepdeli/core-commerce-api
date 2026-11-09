import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';

import { AdminLegalController, PublicLegalController } from './legal.controller.js';
import { LegalService } from './legal.service.js';

@Module({ imports: [AuthModule], controllers: [PublicLegalController, AdminLegalController], providers: [LegalService], exports: [LegalService] })
export class LegalModule {}
