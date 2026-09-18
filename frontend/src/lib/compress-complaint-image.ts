import imageCompression from "browser-image-compression";

export const COMPLAINT_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_COMPLAINT_IMAGE_BYTES = 8 * 1024 * 1024;

export async function compressComplaintImage(file: File): Promise<File> {
  if (!COMPLAINT_IMAGE_TYPES.includes(file.type as (typeof COMPLAINT_IMAGE_TYPES)[number])) {
    throw new Error("unsupported-type");
  }
  if (!file.size) throw new Error("empty-file");
  if (file.size > MAX_COMPLAINT_IMAGE_BYTES) throw new Error("file-too-large");

  const compressed = await imageCompression(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    initialQuality: 0.8,
  });

  return compressed;
}
