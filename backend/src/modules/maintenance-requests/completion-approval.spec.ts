import { Types } from "mongoose";
import { RequestStatus, Role } from "../../common/enums";
import {
  ForbiddenAccessException,
  InvalidOperationException,
} from "../../common/exceptions";
import { MaintenanceRequestsService } from "./maintenance-requests.service";

const ids = {
  request: "64b000000000000000000001",
  engineer: "64b000000000000000000002",
  consultant: "64b000000000000000000003",
  department: "64b000000000000000000004",
  otherDepartment: "64b000000000000000000005",
};

function createService(atomicResult: unknown, departmentId = ids.department) {
  const request = {
    _id: new Types.ObjectId(ids.request),
    requestCode: "EM-202609-0001",
    status: RequestStatus.PENDING_CONSULTANT_APPROVAL,
    engineerId: new Types.ObjectId(ids.engineer),
    departmentId: new Types.ObjectId(ids.department),
  };
  const populatedQuery = {
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(request),
  };
  const requestModel = {
    findOne: jest.fn().mockResolvedValue(request),
    findOneAndUpdate: jest.fn().mockResolvedValue(atomicResult),
    findById: jest.fn().mockReturnValue(populatedQuery),
  };
  const userModel = {
    findById: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          departmentIds: [new Types.ObjectId(departmentId)],
        }),
      }),
    }),
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    }),
  };
  const gateway = { notifyCompletionApproved: jest.fn() };
  const audit = { create: jest.fn() };
  const service = new MaintenanceRequestsService(
    requestModel as never,
    {} as never,
    userModel as never,
    {} as never,
    gateway as never,
    audit as never,
    {} as never,
  );
  return { service, requestModel, gateway, audit };
}

describe("consultant completion approval", () => {
  const user = {
    userId: ids.consultant,
    name: "Consultant",
    role: Role.CONSULTANT,
  };

  it("uses an atomic pending-status condition and records the approver", async () => {
    const { service, requestModel, gateway, audit } = createService({});

    await service.approveCompletion(ids.request, user);

    expect(requestModel.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: ids.request,
        status: RequestStatus.PENDING_CONSULTANT_APPROVAL,
      },
      expect.objectContaining({
        status: RequestStatus.COMPLETED,
        completionApprovedBy: new Types.ObjectId(ids.consultant),
        completionApprovedByName: "Consultant",
      }),
      { new: true },
    );
    expect(audit.create).toHaveBeenCalledTimes(1);
    expect(gateway.notifyCompletionApproved).toHaveBeenCalledTimes(1);
  });

  it("rejects an already-processed approval without auditing it", async () => {
    const { service, audit } = createService(null);

    await expect(service.approveCompletion(ids.request, user)).rejects.toBeInstanceOf(
      InvalidOperationException,
    );
    expect(audit.create).not.toHaveBeenCalled();
  });

  it("rejects a consultant outside the request department", async () => {
    const { service, requestModel } = createService({}, ids.otherDepartment);

    await expect(service.approveCompletion(ids.request, user)).rejects.toBeInstanceOf(
      ForbiddenAccessException,
    );
    expect(requestModel.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
