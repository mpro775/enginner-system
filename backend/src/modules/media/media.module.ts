import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MEDIA_CONFIG } from "./media.constants";
import { createMediaConfig } from "./media.config";
import { ImageProcessorService } from "./services/image-processor.service";
import { ObjectStorageService } from "./services/object-storage.service";
import { MediaService } from "./services/media.service";

@Module({
  providers: [
    {
      provide: MEDIA_CONFIG,
      inject: [ConfigService],
      useFactory: createMediaConfig,
    },
    ImageProcessorService,
    ObjectStorageService,
    MediaService,
  ],
  exports: [MEDIA_CONFIG, ImageProcessorService, ObjectStorageService, MediaService],
})
export class MediaModule {}
