import { Types } from "mongoose";
import { RequestNoteType, RequestStatus, Role } from "../../common/enums";
import { MaintenanceRequestsService } from "./maintenance-requests.service";

const ids = {
  request: "64b000000000000000000001",
  engineer: "64b000000000000000000002",
  actor: "64b000000000000000000003",
  department: "64b000000000000000000004",
};

function serviceForRequest() {
  const request = {
    _id: new Types.ObjectId(ids.request),
    engineerId: new Types.ObjectId(ids.engineer),
    departmentId: new Types.ObjectId(ids.department),
    status: RequestStatus.PENDING_CONSULTANT_APPROVAL,
  };
  const populatedQuery = {
    ...request,
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(request),
    then: (resolve: (value: typeof request) => void) => resolve(request),
  };
  const requestModel = {
    findById: jest.fn().mockReturnValue(populatedQuery),
    findByIdAndUpdate: jest.fn().mockResolvedValue(request),
    findOne: jest.fn().mockResolvedValue(request),
    findOneAndUpdate: jest.fn().mockResolvedValue(request),
  };
  const gateway = {
    notifyRequestUpdated: jest.fn(),
    notifyCompletionRejected: jest.fn(),
  };
  const audit = { create: jest.fn() };
  const service = new MaintenanceRequestsService(
    requestModel as never,
    {} as never,
    {} as never,
    {} as never,
    gateway as never,
    audit as never,
    {} as never,
  );
  return { service, requestModel };
}

describe("structured request note write paths", () => {
  it("writes health and safety notes with author metadata and type", async () => {
    const { service, requestModel } = serviceForRequest();

    await service.addHealthSafetyNote(
      ids.request,
      { healthSafetyNotes: "Safety note" },
      {
        userId: ids.actor,
        name: "Safety",
        role: Role.MAINTENANCE_SAFETY_MONITOR,
      },
    );

    expect(requestModel.findByIdAndUpdate).toHaveBeenCalledWith(
      ids.request,
      expect.objectContaining({
        $push: {
          requestNotes: expect.objectContaining({
            body: "Safety note",
            authorName: "Safety",
            authorRole: Role.MAINTENANCE_SAFETY_MONITOR,
            type: RequestNoteType.HEALTH_SAFETY,
          }),
        },
      }),
    );
  });

  it("writes project manager notes with author metadata and type", async () => {
    const { service, requestModel } = serviceForRequest();

    await service.addProjectManagerNote(
      ids.request,
      { projectManagerNotes: "PM note" },
      { userId: ids.actor, name: "PM", role: Role.PROJECT_MANAGER },
    );

    expect(requestModel.findByIdAndUpdate).toHaveBeenCalledWith(
      ids.request,
      expect.objectContaining({
        $push: {
          requestNotes: expect.objectContaining({
            body: "PM note",
            authorName: "PM",
            authorRole: Role.PROJECT_MANAGER,
            type: RequestNoteType.PROJECT_MANAGER,
          }),
        },
      }),
    );
  });

  it("writes completion rejection as a typed note without a body prefix", async () => {
    const { service, requestModel } = serviceForRequest();

    await service.rejectCompletion(
      ids.request,
      { reason: "Needs another inspection" },
      {
        userId: ids.actor,
        name: "Consultant",
        role: Role.CONSULTANT,
        departmentIds: [ids.department],
      },
    );

    expect(requestModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: ids.request, status: RequestStatus.PENDING_CONSULTANT_APPROVAL },
      expect.objectContaining({
        $push: {
          requestNotes: expect.objectContaining({
            body: "Needs another inspection",
            authorRole: Role.CONSULTANT,
            type: RequestNoteType.COMPLETION_REJECTION,
          }),
        },
      }),
      { new: true },
    );
  });
});
