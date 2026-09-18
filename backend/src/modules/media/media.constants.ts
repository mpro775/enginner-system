export const MEDIA_CONFIG = Symbol("MEDIA_CONFIG");

export const COMPLAINT_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const DEFAULT_MEDIA_LIMITS = {
  signedUrlTtlSeconds: 600,
  maxFiles: 3,
  maxInputBytes: 8 * 1024 * 1024,
  maxInputPixels: 40_000_000,
  fullMaxEdge: 1600,
  thumbMaxEdge: 480,
  fullWebpQuality: 78,
  thumbWebpQuality: 70,
} as const;
