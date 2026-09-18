export interface ProcessedImageVariant {
  buffer: Buffer;
  width: number;
  height: number;
  size: number;
}

export interface ProcessedImage {
  full: ProcessedImageVariant;
  thumbnail: ProcessedImageVariant;
  mimeType: "image/webp";
}
