import { Types } from "mongoose";
import { ComplaintStatus, ComplaintSubmissionLanguage, Role } from "../../common/enums";
import { ForbiddenAccessException, InvalidOperationException } from "../../common/exceptions";
import { StoredImage } from "../media/interfaces/stored-image.interface";
import { ComplaintsService } from "./complaints.service";
import { ComplaintSchema } from "./schemas/complaint.schema";

const locationId = "64b000000000000000000001";
const floorId = "64b000000000000000000002";
const departmentId = "64b000000000000000000003";

const dto = {
  locationId,
  floorId,
  departmentId,
  detailedLocation: "Room 10",
  submissionLanguage: ComplaintSubmissionLanguage.EN,
  reporterNameEn: "Reporter",
  descriptionEn: "A sufficiently clear complaint description",
};

const storedImage = (index = 1): StoredImage => ({
  id: `attachment-${index}`,
  key: `private/image-${index}.webp`,
  thumbnailKey: `private/thumb-${index}.webp`,
  mimeType: "image/webp",
  width: 1200,
  height: 800,
  size: 1000,
  thumbnailWidth: 480,
  thumbnailHeight: 320,
  thumbnailSize: 200,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
});

const populatedQuery = (value: unknown) => {
  const query: any = {
    populate: jest.fn(),
    exec: jest.fn().mockResolvedValue(value),
  };
  query.populate.mockReturnValue(query);
  return query;
};

const selectLeanQuery = (value: unknown) => {
  const query: any = {
    select: jest.fn(),
    lean: jest.fn(),
    exec: jest.fn().mockResolvedValue(value),
  };
  query.select.mockReturnValue(query);
  query.lean.mockReturnValue(query);
  return query;
};

function createHarness(options: { saveError?: Error; mediaError?: Error } = {}) {
  const savedPayloads: any[] = [];
  const populatedDocument: any = {
    _id: new Types.ObjectId(),
    complaintCode: "CMP-2026-001",
    departmentId: new Types.ObjectId(departmentId),
    status: ComplaintStatus.NEW,
    toObject: jest.fn().mockReturnValue({
      id: "complaint-1",
      complaintCode: "CMP-2026-001",
      departmentId: { id: departmentId, name: "Maintenance" },
      status: ComplaintStatus.NEW,
    }),
  };

  const complaintModel: any = jest.fn(function (this: any, payload: any) {
    Object.assign(this, payload);
    savedPayloads.push(payload);
    this.save = options.saveError
      ? jest.fn().mockRejectedValue(options.saveError)
      : jest.fn().mockResolvedValue(this);
  });
  complaintModel.findOne = jest.fn((filter: any) => {
    if (filter?.complaintCode) {
      return {
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      };
    }
    return populatedQuery(populatedDocument);
  });
  complaintModel.countDocuments = jest.fn().mockResolvedValue(0);
  complaintModel.findByIdAndUpdate = jest.fn().mockResolvedValue(null);
  complaintModel.findByIdAndDelete = jest.fn().mockResolvedValue(null);

  const referenceModel = { exists: jest.fn().mockResolvedValue(true) };
  const notifications = {
    resolveRecipientUserIds: jest.fn().mockResolvedValue([]),
    notifyComplaintCreated: jest.fn().mockResolvedValue(undefined),
  };
  const audit = { create: jest.fn().mockResolvedValue(undefined) };
  let imageIndex = 0;
  const media = {
    storeComplaintImage: options.mediaError
      ? jest.fn().mockRejectedValue(options.mediaError)
      : jest.fn().mockImplementation(async () => storedImage(++imageIndex)),
    deleteObjectsBestEffort: jest.fn().mockResolvedValue(undefined),
    deleteObjects: jest.fn().mockResolvedValue(undefined),
    createView: jest.fn().mockImplementation(async (image: StoredImage) => ({
      id: image.id,
      mimeType: image.mimeType,
      width: image.width,
      height: image.height,
      size: image.size,
      thumbnailWidth: image.thumbnailWidth,
      thumbnailHeight: image.thumbnailHeight,
      thumbnailSize: image.thumbnailSize,
      createdAt: image.createdAt,
      url: "https://signed.invalid/full",
      thumbnailUrl: "https://signed.invalid/thumb",
    })),
  };

  const service = new ComplaintsService(
    complaintModel,
    {} as any,
    {} as any,
    referenceModel as any,
    referenceModel as any,
    referenceModel as any,
    {} as any,
    {} as any,
    notifications as any,
    audit as any,
    media as any,
  );

  return {
    service,
    complaintModel,
    populatedDocument,
    referenceModel,
    notifications,
    audit,
    media,
    savedPayloads,
  };
}

const file = (name: string): Express.Multer.File =>
  ({
    fieldname: "images",
    originalname: name,
    encoding: "7bit",
    mimetype: "image/jpeg",
    size: 3,
    buffer: Buffer.from([1, 2, 3]),
  }) as Express.Multer.File;

describe("complaint image attachments", () => {
  it("keeps attachments excluded by default at the schema level", () => {
    expect((ComplaintSchema.path("attachments") as any).options.select).toBe(false);
  });

  it("creates a complaint with zero images without calling storage", async () => {
    const harness = createHarness();
    await harness.service.create(dto, []);

    expect(harness.media.storeComplaintImage).not.toHaveBeenCalled();
    expect(harness.savedPayloads[0].attachments).toEqual([]);
    expect(harness.notifications.notifyComplaintCreated).toHaveBeenCalledWith(
      harness.populatedDocument,
      [],
    );
    expect(
      JSON.stringify(harness.notifications.notifyComplaintCreated.mock.calls[0]),
    ).not.toContain("private/image");
  });

  it("accepts three images and stores them only once before DB save", async () => {
    const harness = createHarness();
    await harness.service.create(dto, [file("1.jpg"), file("2.jpg"), file("3.jpg")]);

    expect(harness.media.storeComplaintImage).toHaveBeenCalledTimes(3);
    expect(harness.savedPayloads[0].attachments).toHaveLength(3);
  });

  it("rejects a fourth image before processing", async () => {
    const harness = createHarness();
    await expect(
      harness.service.create(dto, [
        file("1.jpg"),
        file("2.jpg"),
        file("3.jpg"),
        file("4.jpg"),
      ]),
    ).rejects.toBeInstanceOf(InvalidOperationException);
    expect(harness.media.storeComplaintImage).not.toHaveBeenCalled();
    expect(harness.complaintModel).not.toHaveBeenCalled();
  });

  it("does not create a complaint when storage fails", async () => {
    const harness = createHarness({ mediaError: new Error("R2 unavailable") });
    await expect(harness.service.create(dto, [file("1.jpg")])).rejects.toThrow(
      "R2 unavailable",
    );
    expect(harness.complaintModel).not.toHaveBeenCalled();
  });

  it("cleans uploaded keys when the DB save fails", async () => {
    const harness = createHarness({ saveError: new Error("DB unavailable") });
    await expect(harness.service.create(dto, [file("1.jpg")])).rejects.toThrow(
      "DB unavailable",
    );
    expect(harness.media.deleteObjectsBestEffort).toHaveBeenCalledWith([
      "private/image-1.webp",
      "private/thumb-1.webp",
    ]);
  });

  it("authorizes before signing and returns no private storage keys", async () => {
    const harness = createHarness();
    harness.complaintModel.findOne
      .mockReset()
      .mockReturnValueOnce(populatedQuery(harness.populatedDocument))
      .mockReturnValueOnce(
        selectLeanQuery({ attachments: [storedImage()] }),
      );

    const result = await harness.service.findOne("complaint-1", {
      userId: "admin-1",
      role: Role.ADMIN,
      departmentIds: [],
    });

    expect(harness.media.createView).toHaveBeenCalledTimes(1);
    expect(result.attachments).toEqual([
      expect.objectContaining({
        url: "https://signed.invalid/full",
        thumbnailUrl: "https://signed.invalid/thumb",
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain("private/image");
    expect(JSON.stringify(result)).not.toContain("thumbnailKey");
  });

  it("does not load or sign attachments for an unauthorized user", async () => {
    const harness = createHarness();
    harness.complaintModel.findOne
      .mockReset()
      .mockReturnValueOnce(populatedQuery(harness.populatedDocument));

    await expect(
      harness.service.findOne("complaint-1", {
        userId: "project-manager-1",
        role: Role.PROJECT_MANAGER,
        departmentIds: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenAccessException);
    expect(harness.complaintModel.findOne).toHaveBeenCalledTimes(1);
    expect(harness.media.createView).not.toHaveBeenCalled();
  });

  it("supports an old complaint without attachments", async () => {
    const harness = createHarness();
    harness.complaintModel.findOne
      .mockReset()
      .mockReturnValueOnce(populatedQuery(harness.populatedDocument))
      .mockReturnValueOnce(selectLeanQuery({}));

    const result = await harness.service.findOne("complaint-1", {
      userId: "admin-1",
      role: Role.ADMIN,
      departmentIds: [],
    });
    expect(result.attachments).toEqual([]);
  });

  it("soft delete preserves stored images", async () => {
    const harness = createHarness();
    harness.complaintModel.findOne.mockReturnValueOnce(
      Promise.resolve(harness.populatedDocument),
    );
    await harness.service.softDelete("complaint-1", {
      userId: "admin-1",
      name: "Admin",
    });
    expect(harness.media.deleteObjects).not.toHaveBeenCalled();
  });

  it("restore reuses stored images without storage operations", async () => {
    const harness = createHarness();
    harness.complaintModel.findOne
      .mockReturnValueOnce(Promise.resolve(harness.populatedDocument))
      .mockReturnValueOnce(populatedQuery(harness.populatedDocument));

    await harness.service.restore("complaint-1", {
      userId: "admin-1",
      name: "Admin",
    });
    expect(harness.media.deleteObjects).not.toHaveBeenCalled();
    expect(harness.media.storeComplaintImage).not.toHaveBeenCalled();
  });

  it("hard delete removes full and thumbnail objects before MongoDB", async () => {
    const harness = createHarness();
    const complaint = {
      ...harness.populatedDocument,
      attachments: [storedImage(1), storedImage(2)],
    };
    harness.complaintModel.findById = jest
      .fn()
      .mockReturnValue({ select: jest.fn().mockResolvedValue(complaint) });

    await harness.service.hardDelete("complaint-1", {
      userId: "admin-1",
      name: "Admin",
    });

    expect(harness.media.deleteObjects).toHaveBeenCalledWith([
      "private/image-1.webp",
      "private/thumb-1.webp",
      "private/image-2.webp",
      "private/thumb-2.webp",
    ]);
    expect(harness.media.deleteObjects.mock.invocationCallOrder[0]).toBeLessThan(
      harness.complaintModel.findByIdAndDelete.mock.invocationCallOrder[0],
    );
    expect(harness.audit.create).toHaveBeenCalledWith(
      expect.objectContaining({ changes: expect.objectContaining({ attachmentCount: 2 }) }),
    );
  });

  it("leaves MongoDB intact when hard-delete storage cleanup fails", async () => {
    const harness = createHarness();
    harness.media.deleteObjects.mockRejectedValueOnce(new Error("storage delete failed"));
    harness.complaintModel.findById = jest
      .fn()
      .mockReturnValue({
        select: jest.fn().mockResolvedValue({
          ...harness.populatedDocument,
          attachments: [storedImage()],
        }),
      });

    await expect(
      harness.service.hardDelete("complaint-1", {
        userId: "admin-1",
        name: "Admin",
      }),
    ).rejects.toThrow("storage delete failed");
    expect(harness.complaintModel.findByIdAndDelete).not.toHaveBeenCalled();
  });
});
