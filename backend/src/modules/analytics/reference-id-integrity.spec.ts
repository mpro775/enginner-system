import { readFileSync } from "fs";
import { resolve } from "path";
import { Types } from "mongoose";
import { MaintenanceType, RequestStatus } from "../../common/enums";
import { MaintenanceRequestsService } from "../maintenance-requests/maintenance-requests.service";
import { MachinesService } from "../machines/machines.service";
import { StatisticsService } from "../statistics/statistics.service";
import { AnalyticsService } from "./analytics.service";

const ids = {
  request: "64b000000000000000000001",
  user: "64b000000000000000000002",
  location: "64b000000000000000000003",
  department: "64b000000000000000000004",
  system: "64b000000000000000000005",
  machine: "64b000000000000000000006",
};

function expectObjectId(value: unknown, expected: string) {
  expect(value).toBeInstanceOf(Types.ObjectId);
  expect(String(value)).toBe(expected);
}

describe("reference ID integrity hardening", () => {
  it("stores maintenance request create references as ObjectIds", async () => {
    let payload: Record<string, unknown> = {};
    const populated = { _id: new Types.ObjectId(ids.request) };
    const query = {
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(populated),
    };
    const RequestModel: any = function (
      this: unknown,
      input: Record<string, unknown>,
    ) {
      payload = input;
      return {
        save: jest
          .fn()
          .mockResolvedValue({ _id: new Types.ObjectId(ids.request) }),
      };
    };
    RequestModel.findOne = jest.fn().mockReturnValue({
      sort: jest.fn().mockResolvedValue(null),
    });
    RequestModel.findById = jest.fn().mockReturnValue(query);
    const machineModel = {
      findOne: jest.fn().mockResolvedValue({ components: [] }),
    };
    const userModel = {
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({ _id: ids.user }),
      }),
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      }),
    };
    const systemModel = { exists: jest.fn().mockResolvedValue(true) };
    const service = new MaintenanceRequestsService(
      RequestModel,
      machineModel as never,
      userModel as never,
      systemModel as never,
      { notifyRequestCreated: jest.fn() } as never,
      { create: jest.fn() } as never,
      {} as never,
    );

    await service.create(
      {
        maintenanceType: MaintenanceType.EMERGENCY,
        locationId: ids.location,
        departmentId: ids.department,
        systemId: ids.system,
        machineId: ids.machine,
        reasonText: "test",
      },
      { userId: ids.user, name: "Engineer" },
    );

    expectObjectId(payload.locationId, ids.location);
    expectObjectId(payload.departmentId, ids.department);
    expectObjectId(payload.systemId, ids.system);
    expectObjectId(payload.machineId, ids.machine);
  });

  it("normalizes maintenance request update references before writing", async () => {
    const query = {
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({ _id: ids.request }),
    };
    const requestModel = {
      findById: jest
        .fn()
        .mockReturnValueOnce({
          engineerId: new Types.ObjectId(ids.user),
          status: RequestStatus.IN_PROGRESS,
        })
        .mockReturnValueOnce(query),
      findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
    };
    const existingReferenceModel = {
      exists: jest.fn().mockResolvedValue(true),
    };
    const service = new MaintenanceRequestsService(
      requestModel as never,
      existingReferenceModel as never,
      existingReferenceModel as never,
      existingReferenceModel as never,
      { notifyRequestUpdated: jest.fn() } as never,
      { create: jest.fn() } as never,
      {} as never,
    );

    await service.update(
      ids.request,
      {
        locationId: ids.location,
        departmentId: ids.department,
        systemId: ids.system,
        machineId: ids.machine,
      },
      { userId: ids.user, name: "Engineer", role: "engineer" },
    );

    const update = requestModel.findByIdAndUpdate.mock.calls[0][1];
    expectObjectId(update.$set.locationId, ids.location);
    expectObjectId(update.$set.departmentId, ids.department);
    expectObjectId(update.$set.systemId, ids.system);
    expectObjectId(update.$set.machineId, ids.machine);
  });

  it("stores machine create and update system references as ObjectIds", async () => {
    let createPayload: Record<string, unknown> = {};
    const saved = { populate: jest.fn().mockResolvedValue({}) };
    const MachineModel: any = function (
      this: unknown,
      input: Record<string, unknown>,
    ) {
      createPayload = input;
      return { save: jest.fn().mockResolvedValue(saved) };
    };
    MachineModel.findOne = jest.fn().mockResolvedValue(null);
    MachineModel.findById = jest.fn().mockResolvedValue({
      name: "Machine",
      systemId: new Types.ObjectId(ids.system),
    });
    const updateQuery = { populate: jest.fn().mockResolvedValue({}) };
    MachineModel.findByIdAndUpdate = jest.fn().mockReturnValue(updateQuery);
    const service = new MachinesService(
      MachineModel,
      { del: jest.fn() } as never,
      {} as never,
    );

    await service.create({ name: "Machine", systemId: ids.system });
    await service.update(ids.machine, { systemId: ids.location });

    expectObjectId(createPayload.systemId, ids.system);
    const update = MachineModel.findByIdAndUpdate.mock.calls[0][1];
    expectObjectId(update.systemId, ids.location);
  });

  it("normalizes grouped lookup IDs and keeps emergency-only failure semantics", async () => {
    const requestModel = { aggregate: jest.fn().mockResolvedValue([]) };
    const statistics = new StatisticsService(
      requestModel as never,
      {} as never,
      {} as never,
    );

    await statistics.getByLocation({});
    const locationPipeline = requestModel.aggregate.mock.calls[0][0];
    expect(locationPipeline[1].$set.normalizedLocationId.$convert.to).toBe(
      "objectId",
    );
    expect(locationPipeline[4].$unwind.preserveNullAndEmptyArrays).toBe(true);

    await statistics.getTopFailingMachines({});
    const failurePipeline = requestModel.aggregate.mock.calls[1][0];
    expect(failurePipeline[0].$match).toMatchObject({
      deletedAt: null,
      maintenanceType: MaintenanceType.EMERGENCY,
    });
    expect(failurePipeline[1].$set.normalizedMachineId.$convert.to).toBe(
      "objectId",
    );
    expect(failurePipeline[4].$unwind.preserveNullAndEmptyArrays).toBe(true);
  });

  it("normalizes analytics heatmap and recurring-failure joins", async () => {
    const requestModel = { aggregate: jest.fn().mockResolvedValue([]) };
    const service = new AnalyticsService(
      requestModel as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { get: jest.fn(), set: jest.fn() } as never,
      { get: jest.fn().mockReturnValue("Asia/Riyadh") } as never,
    );
    const range = {
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-09-01T00:00:00.000Z"),
    };

    await (service as any).getRepeatFailures({}, range, 10);
    const repeatPipeline = requestModel.aggregate.mock.calls[0][0];
    expect(repeatPipeline[0].$match).toMatchObject({
      deletedAt: null,
      maintenanceType: MaintenanceType.EMERGENCY,
    });
    expect(repeatPipeline[1].$set.normalizedMachineId.$convert.to).toBe(
      "objectId",
    );

    await service.getLocationSystemHeatmap({
      fromDate: "2026-08-01",
      toDate: "2026-08-31",
    });
    const heatmapPipeline = requestModel.aggregate.mock.calls[1][0];
    expect(heatmapPipeline[1].$set.normalizedLocationId.$convert.to).toBe(
      "objectId",
    );
    expect(heatmapPipeline[2].$group._id).toEqual({
      locationId: "$normalizedLocationId",
      systemId: "$normalizedSystemId",
    });
  });

  it("uses only Latin-number formatters on the Admin Operations Dashboard", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "../frontend/src/pages/dashboard/AdminOperationsDashboard.tsx",
      ),
      "utf8",
    );
    expect(source).toContain('new Intl.NumberFormat("en-US"');
    expect(source).not.toMatch(/(?:toLocaleString|Intl\.NumberFormat)\("ar/);
    expect(source).toContain("tickFormatter");
  });
});
