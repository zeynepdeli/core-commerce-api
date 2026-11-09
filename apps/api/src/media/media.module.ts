import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuthModule } from '../auth/auth.module.js';
import type { Env } from '../config/env.validation.js';

import { AdminMediaController } from './admin-media.controller.js';
import { MediaFileValidatorService } from './media-file-validator.service.js';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';
import { CloudinaryMediaStorage } from './storage/cloudinary-media.storage.js';
import { LocalMediaStorage } from './storage/local-media.storage.js';
import { MEDIA_STORAGE } from './storage/media-storage.js';

@Module({
  imports: [AuthModule],
  controllers: [MediaController, AdminMediaController],
  providers: [
    MediaService,
    MediaFileValidatorService,
    {
      // .env → MEDIA_STORAGE=local | cloudinary
      provide: MEDIA_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get('MEDIA_STORAGE', { infer: true }) === 'cloudinary'
          ? new CloudinaryMediaStorage({
              cloudName: config.get('CLOUDINARY_CLOUD_NAME', { infer: true }) as string,
              apiKey: config.get('CLOUDINARY_API_KEY', { infer: true }) as string,
              apiSecret: config.get('CLOUDINARY_API_SECRET', { infer: true }) as string,
              folder: config.get('CLOUDINARY_FOLDER', { infer: true }),
            })
          : new LocalMediaStorage(),
    },
  ],
  exports: [MediaService],
})
export class MediaModule {}
