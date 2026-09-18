export interface StoredImage {
  id: string;
  key: string;
  thumbnailKey: string;
  mimeType: "image/webp";
  width: number;
  height: number;
  size: number;
  thumbnailWidth: number;
  thumbnailHeight: number;
  thumbnailSize: number;
  createdAt: Date;
}

export interface StoredImageView {
  id: string;
  mimeType: "image/webp";
  width: number;
  height: number;
  size: number;
  thumbnailWidth: number;
  thumbnailHeight: number;
  thumbnailSize: number;
  createdAt: Date;
  url: string;
  thumbnailUrl: string;
}
