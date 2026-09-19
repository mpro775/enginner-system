import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { MEDIA_CONFIG } from "../media.constants";
import { MediaConfig } from "../media.config";

@Injectable()
export class ObjectStorageService {
  private readonly client: S3Client;

  constructor(@Inject(MEDIA_CONFIG) private readonly config: MediaConfig) {
    this.client = new S3Client({
      endpoint: config.endpoint || undefined,
      region: config.region,
      credentials:
        config.accessKeyId && config.secretAccessKey
          ? {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
            }
          : undefined,
    });
  }

  async putObject(key: string, body: Buffer): Promise<void> {
    this.assertConfigured();
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: "image/webp",
        ContentDisposition: "inline",
        CacheControl: "private, max-age=600",
      }),
    );
  }

  async deleteObject(key: string): Promise<void> {
    this.assertConfigured();
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
  }

  async deleteObjects(keys: string[]): Promise<void> {
    const uniqueKeys = [...new Set(keys.filter(Boolean))];
    if (!uniqueKeys.length) return;
    this.assertConfigured();
    const result = await this.client.send(
      new DeleteObjectsCommand({
        Bucket: this.config.bucket,
        Delete: {
          Objects: uniqueKeys.map((Key) => ({ Key })),
          Quiet: true,
        },
      }),
    );
    if (result.Errors?.length) {
      throw new ServiceUnavailableException(
        `Object storage failed to delete ${result.Errors.length} media object(s)`,
      );
    }
  }

  async getSignedReadUrl(key: string): Promise<string> {
    this.assertConfigured();
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        ResponseContentType: "image/webp",
        ResponseContentDisposition: "inline",
      }),
      { expiresIn: this.config.signedUrlTtlSeconds },
    );
  }

  async getObjectBuffer(key: string): Promise<Buffer> {
    this.assertConfigured();
    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      }),
    );
    if (!result.Body) {
      throw new ServiceUnavailableException("Private media object could not be read");
    }
    return Buffer.from(await result.Body.transformToByteArray());
  }

  private assertConfigured(): void {
    if (
      !this.config.endpoint ||
      !this.config.accessKeyId ||
      !this.config.secretAccessKey ||
      !this.config.bucket
    ) {
      throw new ServiceUnavailableException("Private media storage is not configured");
    }
  }
}
