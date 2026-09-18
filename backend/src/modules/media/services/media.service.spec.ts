import { Logger } from "@nestjs/common";
import { MediaService } from "./media.service";

describe("MediaService", () => {
  const processed = {
    mimeType: "image/webp" as const,
    full: {
      buffer: Buffer.from("full"),
      width: 1200,
      height: 800,
      size: 4,
    },
    thumbnail: {
      buffer: Buffer.from("thumb"),
      width: 480,
      height: 320,
      size: 5,
    },
  };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it("waits for both uploads and removes both deterministic keys after a partial failure", async () => {
    let finishThumbnailUpload!: () => void;
    const imageProcessor = { process: jest.fn().mockResolvedValue(processed) };
    const objectStorage = {
      putObject: jest
        .fn()
        .mockRejectedValueOnce(new Error("full upload failed"))
        .mockImplementationOnce(
          () =>
            new Promise<void>((resolve) => {
              finishThumbnailUpload = resolve;
            }),
        ),
      deleteObjects: jest.fn().mockResolvedValue(undefined),
    };
    const service = new MediaService(imageProcessor as any, objectStorage as any);

    const pending = service.storeComplaintImage({
      complaintId: "complaint-1",
      attachmentId: "attachment-1",
      buffer: Buffer.from("input"),
    });
    await Promise.resolve();
    expect(objectStorage.deleteObjects).not.toHaveBeenCalled();

    finishThumbnailUpload();
    await expect(pending).rejects.toThrow("full upload failed");
    expect(objectStorage.deleteObjects).toHaveBeenCalledWith([
      expect.stringMatching(/\/image\.webp$/),
      expect.stringMatching(/\/thumb\.webp$/),
    ]);
  });

  it("returns only safe signed-view fields", async () => {
    const imageProcessor = { process: jest.fn() };
    const objectStorage = {
      getSignedReadUrl: jest
        .fn()
        .mockResolvedValueOnce("https://signed.invalid/full")
        .mockResolvedValueOnce("https://signed.invalid/thumb"),
    };
    const service = new MediaService(imageProcessor as any, objectStorage as any);
    const view = await service.createView({
      id: "attachment-1",
      key: "private/image.webp",
      thumbnailKey: "private/thumb.webp",
      mimeType: "image/webp",
      width: 1200,
      height: 800,
      size: 100,
      thumbnailWidth: 480,
      thumbnailHeight: 320,
      thumbnailSize: 20,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(view).toEqual(
      expect.objectContaining({
        url: "https://signed.invalid/full",
        thumbnailUrl: "https://signed.invalid/thumb",
      }),
    );
    expect(view).not.toHaveProperty("key");
    expect(view).not.toHaveProperty("thumbnailKey");
  });
});
