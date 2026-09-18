import { BadRequestException } from "@nestjs/common";
const sharp: typeof import("sharp").default = require("sharp");
import { MediaConfig } from "../media.config";
import { ImageProcessorService } from "./image-processor.service";

const config: MediaConfig = {
  endpoint: "http://storage.invalid",
  region: "auto",
  accessKeyId: "test",
  secretAccessKey: "test",
  bucket: "test",
  signedUrlTtlSeconds: 600,
  maxFiles: 3,
  maxInputBytes: 8 * 1024 * 1024,
  maxInputPixels: 40_000_000,
  fullMaxEdge: 1600,
  thumbMaxEdge: 480,
  fullWebpQuality: 78,
  thumbWebpQuality: 70,
};

describe("ImageProcessorService", () => {
  const service = new ImageProcessorService(config);

  it.each(["jpeg", "png", "webp"] as const)(
    "normalizes %s input into bounded WebP variants",
    async (format) => {
      let pipeline = sharp({
        create: {
          width: 2000,
          height: 1000,
          channels: 3,
          background: { r: 15, g: 100, b: 180 },
        },
      });
      pipeline = pipeline[format]();
      const input = await pipeline.toBuffer();

      const result = await service.process(input);
      const fullMetadata = await sharp(result.full.buffer).metadata();
      const thumbMetadata = await sharp(result.thumbnail.buffer).metadata();

      expect(result.mimeType).toBe("image/webp");
      expect(fullMetadata.format).toBe("webp");
      expect(fullMetadata.width).toBe(1600);
      expect(fullMetadata.height).toBe(800);
      expect(thumbMetadata.width).toBe(480);
      expect(thumbMetadata.height).toBe(240);
    },
  );

  it("auto-orients and strips EXIF metadata", async () => {
    const input = await sharp({
      create: {
        width: 40,
        height: 20,
        channels: 3,
        background: "red",
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const result = await service.process(input);
    const output = await sharp(result.full.buffer).metadata();

    expect(output.width).toBe(20);
    expect(output.height).toBe(40);
    expect(output.orientation).toBeUndefined();
    expect(output.exif).toBeUndefined();
  });

  it.each([
    ["empty buffer", Buffer.alloc(0)],
    ["corrupt bytes", Buffer.from("not an image")],
    ["PDF renamed as an image", Buffer.from("%PDF-1.7 fake image")],
    [
      "GIF input",
      Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64"),
    ],
  ])("rejects %s", async (_label, input) => {
    await expect(service.process(input)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects an input over the byte limit", async () => {
    const strictService = new ImageProcessorService({ ...config, maxInputBytes: 10 });
    await expect(strictService.process(Buffer.alloc(11))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("rejects decoded dimensions over the pixel limit", async () => {
    const input = await sharp({
      create: {
        width: 11,
        height: 10,
        channels: 3,
        background: "blue",
      },
    })
      .png()
      .toBuffer();
    const strictService = new ImageProcessorService({ ...config, maxInputPixels: 100 });

    await expect(strictService.process(input)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("never upscales small inputs", async () => {
    const input = await sharp({
      create: {
        width: 120,
        height: 80,
        channels: 3,
        background: "green",
      },
    })
      .png()
      .toBuffer();

    const result = await service.process(input);
    expect(result.full.width).toBe(120);
    expect(result.full.height).toBe(80);
    expect(result.thumbnail.width).toBe(120);
    expect(result.thumbnail.height).toBe(80);
  });
});
