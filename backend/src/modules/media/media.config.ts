import { ConfigService } from "@nestjs/config";
import { DEFAULT_MEDIA_LIMITS } from "./media.constants";

export interface MediaConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  signedUrlTtlSeconds: number;
  maxFiles: number;
  maxInputBytes: number;
  maxInputPixels: number;
  fullMaxEdge: number;
  thumbMaxEdge: number;
  fullWebpQuality: number;
  thumbWebpQuality: number;
}

const positiveInteger = (
  config: ConfigService,
  name: string,
  fallback: number,
): number => {
  const raw = config.get<string | number>(name, fallback);
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
};

export function createMediaConfig(config: ConfigService): MediaConfig {
  const result: MediaConfig = {
    endpoint: config.get<string>("MEDIA_S3_ENDPOINT", "").trim(),
    region: config.get<string>("MEDIA_S3_REGION", "auto").trim() || "auto",
    accessKeyId: config.get<string>("MEDIA_S3_ACCESS_KEY_ID", "").trim(),
    secretAccessKey: config
      .get<string>("MEDIA_S3_SECRET_ACCESS_KEY", "")
      .trim(),
    bucket: config.get<string>("MEDIA_S3_BUCKET", "").trim(),
    signedUrlTtlSeconds: positiveInteger(
      config,
      "MEDIA_SIGNED_URL_TTL_SECONDS",
      DEFAULT_MEDIA_LIMITS.signedUrlTtlSeconds,
    ),
    maxFiles: positiveInteger(
      config,
      "MEDIA_MAX_FILES",
      DEFAULT_MEDIA_LIMITS.maxFiles,
    ),
    maxInputBytes: positiveInteger(
      config,
      "MEDIA_MAX_INPUT_BYTES",
      DEFAULT_MEDIA_LIMITS.maxInputBytes,
    ),
    maxInputPixels: positiveInteger(
      config,
      "MEDIA_MAX_INPUT_PIXELS",
      DEFAULT_MEDIA_LIMITS.maxInputPixels,
    ),
    fullMaxEdge: positiveInteger(
      config,
      "MEDIA_FULL_MAX_EDGE",
      DEFAULT_MEDIA_LIMITS.fullMaxEdge,
    ),
    thumbMaxEdge: positiveInteger(
      config,
      "MEDIA_THUMB_MAX_EDGE",
      DEFAULT_MEDIA_LIMITS.thumbMaxEdge,
    ),
    fullWebpQuality: positiveInteger(
      config,
      "MEDIA_FULL_WEBP_QUALITY",
      DEFAULT_MEDIA_LIMITS.fullWebpQuality,
    ),
    thumbWebpQuality: positiveInteger(
      config,
      "MEDIA_THUMB_WEBP_QUALITY",
      DEFAULT_MEDIA_LIMITS.thumbWebpQuality,
    ),
  };

  if (result.maxFiles > 3) {
    throw new Error("MEDIA_MAX_FILES cannot exceed the product limit of 3");
  }
  if (result.maxInputBytes > DEFAULT_MEDIA_LIMITS.maxInputBytes) {
    throw new Error("MEDIA_MAX_INPUT_BYTES cannot exceed 8388608");
  }
  if (result.maxInputPixels > DEFAULT_MEDIA_LIMITS.maxInputPixels) {
    throw new Error("MEDIA_MAX_INPUT_PIXELS cannot exceed 40000000");
  }
  if (result.fullMaxEdge > DEFAULT_MEDIA_LIMITS.fullMaxEdge) {
    throw new Error("MEDIA_FULL_MAX_EDGE cannot exceed 1600");
  }
  if (result.thumbMaxEdge > DEFAULT_MEDIA_LIMITS.thumbMaxEdge) {
    throw new Error("MEDIA_THUMB_MAX_EDGE cannot exceed 480");
  }
  if (result.fullWebpQuality > 100 || result.thumbWebpQuality > 100) {
    throw new Error("WebP quality values must be between 1 and 100");
  }

  if (config.get<string>("NODE_ENV") === "production") {
    const missing = [
      ["MEDIA_S3_ENDPOINT", result.endpoint],
      ["MEDIA_S3_ACCESS_KEY_ID", result.accessKeyId],
      ["MEDIA_S3_SECRET_ACCESS_KEY", result.secretAccessKey],
      ["MEDIA_S3_BUCKET", result.bucket],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name);
    if (missing.length) {
      throw new Error(`Missing production media configuration: ${missing.join(", ")}`);
    }
  }

  return result;
}
