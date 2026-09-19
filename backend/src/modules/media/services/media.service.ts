import { Injectable, Logger } from "@nestjs/common";
import { ImageProcessorService } from "./image-processor.service";
import { ObjectStorageService } from "./object-storage.service";
import {
  StoredImage,
  StoredImageView,
} from "../interfaces/stored-image.interface";
import { ProcessedImage } from "../interfaces/processed-image.interface";

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly imageProcessor: ImageProcessorService,
    private readonly objectStorage: ObjectStorageService,
  ) {}

  async storeComplaintImage(input: {
    complaintId: string;
    attachmentId: string;
    buffer: Buffer;
  }): Promise<StoredImage> {
    const startedAt = Date.now();
    let processed: ProcessedImage;
    try {
      processed = await this.imageProcessor.process(input.buffer);
    } catch (error) {
      this.logger.error(
        `Complaint media processing failed complaintId=${input.complaintId} attachmentId=${input.attachmentId} inputBytes=${input.buffer.length}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const prefix = `complaints/${year}/${month}/${input.complaintId}/${input.attachmentId}`;
    const key = `${prefix}/image.webp`;
    const thumbnailKey = `${prefix}/thumb.webp`;
    const storageStartedAt = Date.now();

    try {
      const uploads = await Promise.allSettled([
        this.objectStorage.putObject(key, processed.full.buffer),
        this.objectStorage.putObject(thumbnailKey, processed.thumbnail.buffer),
      ]);
      const failedUpload = uploads.find(
        (upload): upload is PromiseRejectedResult => upload.status === "rejected",
      );
      if (failedUpload) throw failedUpload.reason;
    } catch (error) {
      await this.deleteObjectsBestEffort([key, thumbnailKey]);
      this.logger.error(
        `Complaint media upload failed complaintId=${input.complaintId} attachmentId=${input.attachmentId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }

    this.logger.log(
      `Stored complaint image complaintId=${input.complaintId} attachmentId=${input.attachmentId} inputBytes=${input.buffer.length} outputBytes=${processed.full.size} thumbnailBytes=${processed.thumbnail.size} processingMs=${storageStartedAt - startedAt} storageUploadMs=${Date.now() - storageStartedAt}`,
    );

    return {
      id: input.attachmentId,
      key,
      thumbnailKey,
      mimeType: "image/webp",
      width: processed.full.width,
      height: processed.full.height,
      size: processed.full.size,
      thumbnailWidth: processed.thumbnail.width,
      thumbnailHeight: processed.thumbnail.height,
      thumbnailSize: processed.thumbnail.size,
      createdAt: now,
    };
  }

  async createView(image: StoredImage): Promise<StoredImageView> {
    const [url, thumbnailUrl] = await Promise.all([
      this.objectStorage.getSignedReadUrl(image.key),
      this.objectStorage.getSignedReadUrl(image.thumbnailKey),
    ]);
    return {
      id: image.id,
      mimeType: image.mimeType,
      width: image.width,
      height: image.height,
      size: image.size,
      thumbnailWidth: image.thumbnailWidth,
      thumbnailHeight: image.thumbnailHeight,
      thumbnailSize: image.thumbnailSize,
      createdAt: image.createdAt,
      url,
      thumbnailUrl,
    };
  }

  async createJpegDownload(image: StoredImage): Promise<Buffer> {
    const fullImage = await this.objectStorage.getObjectBuffer(image.key);
    return this.imageProcessor.convertToJpeg(fullImage);
  }

  async deleteObjects(keys: string[]): Promise<void> {
    await this.objectStorage.deleteObjects(keys);
  }

  async deleteObjectsBestEffort(keys: string[]): Promise<void> {
    if (!keys.length) return;
    try {
      await this.objectStorage.deleteObjects(keys);
    } catch (error) {
      this.logger.error(
        `Best-effort media cleanup failed objectCount=${new Set(keys).size}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
