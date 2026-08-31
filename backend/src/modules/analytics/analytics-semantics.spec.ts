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
import { resolveAnalyticsPeriod } from "./utils/date-period.util";

describe("analytics snapshot semantics", () => {
  const requestModel = { aggregate: jest.fn(), findById: jest.fn() };
  const taskModel = { aggregate: jest.fn() };
  const complaintModel = { countDocuments: jest.fn() };
  const machineModel = {};
  const auditLogModel = { aggregate: jest.fn() };
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
      RequestStatus.PENDING_CONSULTANT_APPROVAL,
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
      "2026-08-28T21:00:00.000Z",
    );
  });

  it("excludes today and tomorrow from overdue and due-preventive semantics", async () => {
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
      "2026-08-28T21:00:00.000Z",
    );
    expect(summary).toMatchObject({
      scheduled: 3,
      scheduledDue: 2,
      completed: 2,
      compliancePercent: 100,
    });
  });

  it("compares year-to-date with the same portion of the previous year", () => {
    const period = resolveAnalyticsPeriod(
      "2026-01-01",
      "2026-08-30",
      "Asia/Riyadh",
      new Date("2026-08-30T12:00:00.000Z"),
      "year_to_date",
    );

    expect(period.previousFrom.toISOString()).toBe(
      "2024-12-31T21:00:00.000Z",
    );
    expect(period.previousToExclusive.toISOString()).toBe(
      "2025-08-30T21:00:00.000Z",
    );
    expect(period.comparisonMode).toBe("previous_year_to_date");
  });

  it("loads request activity across String/ObjectId ids and derives only missing lifecycle events", async () => {
    auditLogModel.aggregate.mockResolvedValue([
      {
        _id: "audit-create",
        action: "create",
        userName: "مدير",
        createdAt: new Date("2026-08-24T07:06:00.000Z"),
        changes: { status: RequestStatus.IN_PROGRESS },
      },
    ]);
    requestModel.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          openedAt: new Date("2026-08-24T07:06:00.000Z"),
          stoppedAt: new Date("2026-08-25T10:20:00.000Z"),
          stopReason: "  عدم   توفر قطع غيار  ",
        }),
      }),
    });

    const result = await createService().getRequestActivity(
      "66cc4d3f22b91d593535aaaa",
    );
    const pipeline = auditLogModel.aggregate.mock.calls[0][0];

    expect(pipeline[0].$match).toEqual({
      entity: "MaintenanceRequest",
      $expr: {
        $eq: [{ $toString: "$entityId" }, "66cc4d3f22b91d593535aaaa"],
      },
    });
    expect(result.filter((event) => event.summary === "تم إنشاء الطلب")).toHaveLength(
      1,
    );
    expect(result[0]).toMatchObject({
      summary: "تم إيقاف الطلب",
      actorName: null,
      relevantChanges: { stopReason: "عدم توفر قطع غيار" },
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
      "الطلبات غير المغلقة",
      "الطارئة غير المغلقة",
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
