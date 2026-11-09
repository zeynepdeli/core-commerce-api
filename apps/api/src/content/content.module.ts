import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';

import { AdminContentController, ShopContentController } from './content.controller.js';
import { ContentService } from './content.service.js';

@Module({ imports: [AuthModule], controllers: [ShopContentController, AdminContentController], providers: [ContentService], exports: [ContentService] })
export class ContentModule {}
