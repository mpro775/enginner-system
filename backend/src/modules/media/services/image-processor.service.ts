import { BadRequestException, Inject, Injectable } from "@nestjs/common";
const sharp: typeof import("sharp").default = require("sharp");
import { MEDIA_CONFIG } from "../media.constants";
import { MediaConfig } from "../media.config";
import { ProcessedImage } from "../interfaces/processed-image.interface";

@Injectable()
export class ImageProcessorService {
  constructor(@Inject(MEDIA_CONFIG) private readonly config: MediaConfig) {}

  async process(input: Buffer): Promise<ProcessedImage> {
    if (!input?.length) {
      throw new BadRequestException("Image file is empty");
    }
    if (input.length > this.config.maxInputBytes) {
      throw new BadRequestException("Each image must be 8 MB or smaller");
    }

    try {
      const decoder = sharp(input, {
        failOn: "error",
        limitInputPixels: this.config.maxInputPixels,
      });
      const metadata = await decoder.metadata();

      if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format)) {
        throw new BadRequestException("Only JPEG, PNG, and WebP images are supported");
      }
      if ((metadata.pages ?? 1) !== 1) {
        throw new BadRequestException("Animated or multi-page images are not supported");
      }
      if (!metadata.width || !metadata.height) {
        throw new BadRequestException("Image dimensions could not be read");
      }
      if (metadata.width * metadata.height > this.config.maxInputPixels) {
        throw new BadRequestException("Image dimensions exceed the 40 megapixel limit");
      }

      const normalized = sharp(input, {
        failOn: "error",
        limitInputPixels: this.config.maxInputPixels,
      }).rotate();

      const [full, thumbnail] = await Promise.all([
        normalized
          .clone()
          .resize({
            width: this.config.fullMaxEdge,
            height: this.config.fullMaxEdge,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: this.config.fullWebpQuality })
          .toBuffer({ resolveWithObject: true }),
        normalized
          .clone()
          .resize({
            width: this.config.thumbMaxEdge,
            height: this.config.thumbMaxEdge,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: this.config.thumbWebpQuality })
          .toBuffer({ resolveWithObject: true }),
      ]);

      return {
        mimeType: "image/webp",
        full: {
          buffer: full.data,
          width: full.info.width,
          height: full.info.height,
          size: full.info.size,
        },
        thumbnail: {
          buffer: thumbnail.data,
          width: thumbnail.info.width,
          height: thumbnail.info.height,
          size: thumbnail.info.size,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException("The uploaded file is not a valid supported image");
    }
  }
}
