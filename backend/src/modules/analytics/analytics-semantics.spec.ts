import { readFileSync } from "fs";
import { resolve } from "path";
import {
  MaintenanceType,
  OPEN_REQUEST_STATUSES,
  RequestStatus,
  Role,
  TaskStatus,
} from "../../common/enums";
import { MaintenanceRequestsService } from "../maintenance-requests/maintenance-requests.service";
import { AnalyticsService } from "./analytics.service";

describe("analytics snapshot semantics", () => {
  const requestModel = { aggregate: jest.fn() };
  const taskModel = { aggregate: jest.fn() };
  const complaintModel = { countDocuments: jest.fn() };
  const machineModel = {};
  const auditLogModel = {};
  const cacheManager = {
    get: jest.fn().mockResolvedValue(undefined),
    set: jest.fn().mockResolvedValue(undefined),
  };
  const configService = {
    get: jest.fn().mockReturnValue("Asia/Riyadh"),
  };

  const createService = () =>
    new AnalyticsService(
      requestModel as never,
      taskModel as never,
      complaintModel as never,
      machineModel as never,
      auditLogModel as never,
      cacheManager as never,
      configService as never,
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("counts old open and stopped requests without a creation-period match", async () => {
    requestModel.aggregate.mockResolvedValue([
      {
        openRequests: 2,
        emergencyOpen: 1,
        stoppedRequests: 1,
        avgOpenAgeMs: 23 * 24 * 60 * 60 * 1000,
      },
    ]);

    const result = await (createService() as any).getCurrentRequestSnapshot({});
    const pipeline = requestModel.aggregate.mock.calls[0][0];

    expect(pipeline[0].$match).toEqual({
      deletedAt: null,
      status: { $in: [...OPEN_REQUEST_STATUSES] },
    });
    expect(pipeline[0].$match.createdAt).toBeUndefined();
    expect(result).toMatchObject({
      openRequests: 2,
      emergencyOpen: 1,
      stoppedRequests: 1,
    });
  });

  it("uses every current open request for aging and deterministic boundaries", async () => {
    requestModel.aggregate
      .mockResolvedValueOnce([
        {
          totalOpen: 2,
          under4Hours: 0,
          fourTo24Hours: 1,
          oneTo3Days: 0,
          threeDaysOrMore: 1,
        },
      ])
      .mockResolvedValueOnce([{ id: "old-request" }]);

    const result = await createService().getAging({});
    const bucketPipeline = requestModel.aggregate.mock.calls[0][0];
    const oldestPipeline = requestModel.aggregate.mock.calls[1][0];

    expect(bucketPipeline[0].$match.createdAt).toBeUndefined();
    expect(bucketPipeline[0].$match.status.$in).toEqual([
      RequestStatus.IN_PROGRESS,
      RequestStatus.STOPPED,
    ]);
    expect(bucketPipeline[2].$group.fourTo24Hours.$sum.$cond[0].$and).toEqual([
      { $gte: ["$ageHours", 4] },
      { $lt: ["$ageHours", 24] },
    ]);
    expect(bucketPipeline[2].$group.threeDaysOrMore.$sum.$cond[0]).toEqual({
      $gte: ["$ageHours", 72],
    });
    expect(oldestPipeline[1]).toEqual({ $sort: { openedAt: 1 } });
    expect(result.totalOpen).toBe(2);
  });

  it("keeps emergency-open analytics and drill-down on the same statuses", async () => {
    const requestService = new MaintenanceRequestsService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const filter = await (requestService as any).buildFilter(
      { openOnly: true, maintenanceType: MaintenanceType.EMERGENCY },
      { userId: "admin", role: Role.ADMIN },
    );

    expect(filter).toMatchObject({
      deletedAt: null,
      maintenanceType: MaintenanceType.EMERGENCY,
      status: { $in: [...OPEN_REQUEST_STATUSES] },
    });
  });

  it("includes old unresolved complaints and old overdue preventive tasks", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-29T12:00:00.000Z"));
    complaintModel.countDocuments.mockResolvedValue(1);
    taskModel.aggregate.mockResolvedValue([{ count: 1 }]);
    const service = createService() as any;

    await expect(service.countUnresolvedComplaints({})).resolves.toBe(1);
    const complaintMatch = complaintModel.countDocuments.mock.calls[0][0];
    expect(complaintMatch.createdAt).toBeUndefined();

    await expect(service.countCurrentOverduePreventive({})).resolves.toBe(1);
    const pipeline = taskModel.aggregate.mock.calls[0][0];
    expect(pipeline[0]).toEqual({ $match: { deletedAt: null } });
    expect(pipeline[2].$match.status).toEqual({
      $nin: [TaskStatus.COMPLETED, TaskStatus.CANCELLED],
    });
    expect(pipeline[2].$match.scheduledDate.$lt.toISOString()).toBe(
      "2026-08-29T21:00:00.000Z",
    );
  });

  it("excludes tomorrow from the preventive compliance denominator", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-29T12:00:00.000Z"));
    taskModel.aggregate.mockResolvedValue([
      {
        scheduled: 3,
        scheduledDue: 2,
        completed: 2,
        completedDue: 2,
        overdue: 0,
        cancelled: 0,
      },
    ]);
    const service = createService() as any;
    const summary = await service.getPreventiveSummaryForRange(
      {},
      {
        from: new Date("2026-08-27T21:00:00.000Z"),
        to: new Date("2026-09-01T21:00:00.000Z"),
      },
    );
    const pipeline = taskModel.aggregate.mock.calls[0][0];
    const dueCondition = pipeline[3].$group.scheduledDue.$sum.$cond[0].$and;

    expect(dueCondition[1].$lt[1].toISOString()).toBe(
      "2026-08-29T21:00:00.000Z",
    );
    expect(summary).toMatchObject({
      scheduled: 3,
      scheduledDue: 2,
      completed: 2,
      compliancePercent: 100,
    });
  });

  it("does not render period comparisons on snapshot cards", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "../frontend/src/pages/dashboard/AdminOperationsDashboard.tsx",
      ),
      "utf8",
    );
    for (const title of [
      "الطلبات المفتوحة",
      "الطارئة المفتوحة",
      "الطلبات المتوقفة",
    ]) {
      const card = source.match(
        new RegExp(`<KpiCard\\s+title="${title}"[\\s\\S]*?/>`),
      )?.[0];
      expect(card).toBeDefined();
      expect(card).not.toContain("comparison=");
    }
    expect(source).toContain(
      "/app/requests?maintenanceType=emergency&openOnly=true",
    );
  });
});
