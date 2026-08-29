import { CACHE_MANAGER } from "@nestjs/cache-manager";
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Cache } from "cache-manager";
import { Model, Types } from "mongoose";
import {
  ComplaintStatus,
  MaintenanceType,
  OPEN_REQUEST_STATUSES,
  RequestStatus,
  TaskStatus,
} from "../../common/enums";
import {
  MaintenanceRequest,
  MaintenanceRequestDocument,
} from "../maintenance-requests/schemas/maintenance-request.schema";
import {
  ScheduledTask,
  ScheduledTaskDocument,
} from "../scheduled-tasks/schemas/scheduled-task.schema";
import {
  Complaint,
  ComplaintDocument,
} from "../complaints/schemas/complaint.schema";
import {
  AnalyticsFilterDto,
  AnalyticsTrendFilterDto,
  MachineProfileQueryDto,
  RepeatFailuresQueryDto,
} from "./dto/analytics-filter.dto";
import { Machine, MachineDocument } from "../machines/schemas/machine.schema";
import {
  AuditLog,
  AuditLogDocument,
} from "../audit-logs/schemas/audit-log.schema";
import {
  AnalyticsPeriod,
  addZonedDays,
  resolveAnalyticsPeriod,
  startOfZonedDay,
} from "./utils/date-period.util";

const CACHE_TTL = 60000;
const HOUR_MS = 60 * 60 * 1000;

export interface PeriodComparison {
  current: number;
  previous: number;
  absoluteChange: number;
  percentChange: number | null;
  comparable: boolean;
}

export interface RequestMetrics {
  totalRequests: number;
  openRequests: number;
  emergencyRequests: number;
  emergencyOpen: number;
  stoppedRequests: number;
  completedRequests: number;
  preventiveRequests: number;
  avgCompletionTimeHours: number;
  minCompletionTimeHours: number;
  maxCompletionTimeHours: number;
  openRequestAverageAgeHours: number;
  completionRate: number;
  stopRate: number;
  emergencyPreventiveRatio: number | null;
}

export interface PreventiveSummary {
  scheduled: number;
  scheduledDue: number;
  completed: number;
  overdue: number;
  cancelled: number;
  compliancePercent: number | null;
}

interface CurrentRequestSnapshot {
  openRequests: number;
  emergencyOpen: number;
  stoppedRequests: number;
  openRequestAverageAgeHours: number;
}

@Injectable()
export class AnalyticsService {
  private readonly timeZone: string;

  constructor(
    @InjectModel(MaintenanceRequest.name)
    private readonly requestModel: Model<MaintenanceRequestDocument>,
    @InjectModel(ScheduledTask.name)
    private readonly taskModel: Model<ScheduledTaskDocument>,
    @InjectModel(Complaint.name)
    private readonly complaintModel: Model<ComplaintDocument>,
    @InjectModel(Machine.name)
    private readonly machineModel: Model<MachineDocument>,
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    configService: ConfigService,
  ) {
    const configured = configService.get<string>(
      "ANALYTICS_TIMEZONE",
      "Asia/Riyadh",
    );
    try {
      new Intl.DateTimeFormat("en", { timeZone: configured }).format();
      this.timeZone = configured;
    } catch {
      this.timeZone = "Asia/Riyadh";
    }
  }

  async getOperationsDashboard(filter: AnalyticsFilterDto) {
    return this.cached("operations", filter, async () => {
      const period = this.period(filter);
      const currentRange = { from: period.from, to: period.toExclusive };
      const previousRange = {
        from: period.previousFrom,
        to: period.previousToExclusive,
      };

      const [
        current,
        previous,
        requestSnapshot,
        preventive,
        previousPreventive,
        overduePreventive,
        upcomingPreventive7Days,
        aging,
        unresolvedComplaints,
        repeatFailures,
        previousRepeatFailures,
        trends,
        statusDistribution,
        typeDistribution,
      ] = await Promise.all([
        this.getRequestMetrics(filter, currentRange),
        this.getRequestMetrics(filter, previousRange),
        this.getCurrentRequestSnapshot(filter),
        this.getPreventiveSummaryForRange(filter, currentRange),
        this.getPreventiveSummaryForRange(filter, previousRange),
        this.countCurrentOverduePreventive(filter),
        this.countUpcomingPreventive(filter),
        this.getAging(filter),
        this.countUnresolvedComplaints(filter),
        this.getRepeatFailures(filter, currentRange, 5),
        this.getRepeatFailures(filter, previousRange, 1),
        this.getTrends(filter, "daily"),
        this.getDistribution(filter, currentRange, "status"),
        this.getDistribution(filter, currentRange, "maintenanceType"),
      ]);

      return {
        timezone: this.timeZone,
        period: this.serialisePeriod(period),
        totalRequests: current.totalRequests,
        openRequests: requestSnapshot.openRequests,
        emergencyOpen: requestSnapshot.emergencyOpen,
        stoppedRequests: requestSnapshot.stoppedRequests,
        overduePreventive,
        upcomingPreventive7Days,
        unresolvedComplaints,
        repeatFailureMachines: repeatFailures.totalMachines,
        avgCompletionTimeHours: current.avgCompletionTimeHours,
        preventiveCompliance: preventive.compliancePercent,
        aging: aging.buckets,
        trends,
        statusDistribution,
        typeDistribution,
        topRecurringFailures: repeatFailures.machines,
        comparisons: {
          totalRequests: this.comparison(
            current.totalRequests,
            previous.totalRequests,
          ),
          emergencyRequests: this.comparison(
            current.emergencyRequests,
            previous.emergencyRequests,
          ),
          avgCompletionTime: this.comparison(
            current.avgCompletionTimeHours,
            previous.avgCompletionTimeHours,
          ),
          preventiveCompliance: this.comparison(
            preventive.compliancePercent,
            previousPreventive.compliancePercent,
          ),
          repeatFailures: this.comparison(
            repeatFailures.totalMachines,
            previousRepeatFailures.totalMachines,
          ),
        },
      };
    });
  }

  async getOverview(filter: AnalyticsTrendFilterDto) {
    return this.cached("overview", filter, async () => {
      const period = this.period(filter);
      const range = { from: period.from, to: period.toExclusive };
      const [
        metrics,
        requestSnapshot,
        preventive,
        comparisons,
        aging,
        trends,
        requestsPerEngineer,
        requestsPerDepartment,
        requestsPerLocation,
        requestsPerSystem,
        requestsPerMachine,
        dayHourHeatmap,
        locationSystemHeatmap,
      ] = await Promise.all([
        this.getRequestMetrics(filter, range),
        this.getCurrentRequestSnapshot(filter),
        this.getPreventiveSummaryForRange(filter, range),
        this.getComparisons(filter),
        this.getAging(filter),
        this.getTrends(filter, filter.period),
        this.getRanking(filter, range, "engineerId", "users"),
        this.getRanking(filter, range, "departmentId", "departments"),
        this.getRanking(filter, range, "locationId", "locations"),
        this.getRanking(filter, range, "systemId", "systems"),
        this.getRanking(filter, range, "machineId", "machines"),
        this.getDayHourHeatmap(filter),
        this.getLocationSystemHeatmap(filter),
      ]);

      return {
        timezone: this.timeZone,
        period: this.serialisePeriod(period),
        kpis: {
          ...metrics,
          ...requestSnapshot,
          preventiveCompliance: preventive.compliancePercent,
          overduePreventiveTasks: preventive.overdue,
        },
        preventive,
        comparisons,
        aging,
        trends,
        rankings: {
          requestsPerEngineer,
          requestsPerDepartment,
          requestsPerLocation,
          requestsPerSystem,
          requestsPerMachine,
        },
        heatmaps: {
          dayHour: dayHourHeatmap,
          locationSystem: locationSystemHeatmap,
        },
      };
    });
  }

  async getAging(filter: AnalyticsFilterDto) {
    const now = new Date();
    const match = this.requestMatch(filter);
    match.status = { $in: [...OPEN_REQUEST_STATUSES] };

    const [bucketRows, oldestOpenRequests] = await Promise.all([
      this.requestModel.aggregate([
        { $match: match },
        {
          $project: {
            ageHours: { $divide: [{ $subtract: [now, "$openedAt"] }, HOUR_MS] },
          },
        },
        {
          $group: {
            _id: null,
            totalOpen: { $sum: 1 },
            under4Hours: { $sum: { $cond: [{ $lt: ["$ageHours", 4] }, 1, 0] } },
            fourTo24Hours: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ["$ageHours", 4] },
                      { $lt: ["$ageHours", 24] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            oneTo3Days: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ["$ageHours", 24] },
                      { $lt: ["$ageHours", 72] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            threeDaysOrMore: {
              $sum: { $cond: [{ $gte: ["$ageHours", 72] }, 1, 0] },
            },
          },
        },
      ]),
      this.requestModel.aggregate([
        { $match: match },
        { $sort: { openedAt: 1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "machines",
            localField: "machineId",
            foreignField: "_id",
            as: "machine",
          },
        },
        {
          $lookup: {
            from: "locations",
            localField: "locationId",
            foreignField: "_id",
            as: "location",
          },
        },
        {
          $project: {
            _id: 0,
            id: { $toString: "$_id" },
            requestCode: 1,
            openedAt: 1,
            ageHours: {
              $round: [
                { $divide: [{ $subtract: [now, "$openedAt"] }, HOUR_MS] },
                1,
              ],
            },
            status: 1,
            machine: { $ifNull: [{ $first: "$machine.name" }, "-"] },
            location: { $ifNull: [{ $first: "$location.name" }, "-"] },
          },
        },
      ]),
    ]);

    const buckets = bucketRows[0] || {};
    return {
      totalOpen: buckets.totalOpen || 0,
      buckets: {
        under4Hours: buckets.under4Hours || 0,
        fourTo24Hours: buckets.fourTo24Hours || 0,
        oneTo3Days: buckets.oneTo3Days || 0,
        threeDaysOrMore: buckets.threeDaysOrMore || 0,
      },
      oldestOpenRequests,
    };
  }

  async getComparisons(filter: AnalyticsFilterDto) {
    const period = this.period(filter);
    const currentRange = { from: period.from, to: period.toExclusive };
    const previousRange = {
      from: period.previousFrom,
      to: period.previousToExclusive,
    };
    const [
      current,
      previous,
      preventive,
      previousPreventive,
      repeat,
      previousRepeat,
    ] = await Promise.all([
      this.getRequestMetrics(filter, currentRange),
      this.getRequestMetrics(filter, previousRange),
      this.getPreventiveSummaryForRange(filter, currentRange),
      this.getPreventiveSummaryForRange(filter, previousRange),
      this.getRepeatFailures(filter, currentRange, 1),
      this.getRepeatFailures(filter, previousRange, 1),
    ]);

    return {
      totalRequests: this.comparison(
        current.totalRequests,
        previous.totalRequests,
      ),
      emergencyRequests: this.comparison(
        current.emergencyRequests,
        previous.emergencyRequests,
      ),
      avgCompletionTime: this.comparison(
        current.avgCompletionTimeHours,
        previous.avgCompletionTimeHours,
      ),
      preventiveCompliance: this.comparison(
        preventive.compliancePercent,
        previousPreventive.compliancePercent,
      ),
      repeatFailures: this.comparison(
        repeat.totalMachines,
        previousRepeat.totalMachines,
      ),
    };
  }

  async getDayHourHeatmap(filter: AnalyticsFilterDto) {
    const period = this.period(filter);
    const match = this.requestMatch(filter, {
      from: period.from,
      to: period.toExclusive,
    });
    match.maintenanceType = MaintenanceType.EMERGENCY;
    const points = await this.requestModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            dayOfWeek: {
              $subtract: [
                { $dayOfWeek: { date: "$openedAt", timezone: this.timeZone } },
                1,
              ],
            },
            hour: { $hour: { date: "$openedAt", timezone: this.timeZone } },
          },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          dayOfWeek: "$_id.dayOfWeek",
          hour: "$_id.hour",
          count: 1,
        },
      },
      { $sort: { dayOfWeek: 1, hour: 1 } },
    ]);
    return { timezone: this.timeZone, dayZero: "Sunday", points };
  }

  async getLocationSystemHeatmap(filter: AnalyticsFilterDto) {
    const period = this.period(filter);
    const rows = await this.requestModel.aggregate([
      {
        $match: this.requestMatch(filter, {
          from: period.from,
          to: period.toExclusive,
        }),
      },
      {
        $group: {
          _id: { locationId: "$locationId", systemId: "$systemId" },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "locations",
          localField: "_id.locationId",
          foreignField: "_id",
          as: "location",
        },
      },
      {
        $lookup: {
          from: "systems",
          localField: "_id.systemId",
          foreignField: "_id",
          as: "system",
        },
      },
      {
        $project: {
          _id: 0,
          locationId: { $toString: "$_id.locationId" },
          locationName: { $ifNull: [{ $first: "$location.name" }, "-"] },
          systemId: { $toString: "$_id.systemId" },
          systemName: { $ifNull: [{ $first: "$system.name" }, "-"] },
          count: 1,
        },
      },
    ]);

    const locationTotals = this.topIds(rows, "locationId", 12);
    const systemTotals = this.topIds(rows, "systemId", 12);
    return rows
      .filter(
        (row) =>
          locationTotals.has(row.locationId) && systemTotals.has(row.systemId),
      )
      .sort((a, b) => b.count - a.count);
  }

  async getPreventiveSummary(filter: AnalyticsFilterDto) {
    const period = this.period(filter);
    return this.getPreventiveSummaryForRange(filter, {
      from: period.from,
      to: period.toExclusive,
    });
  }

  async getUpcomingPreventive(filter: AnalyticsFilterDto) {
    const now = new Date();
    const from = startOfZonedDay(now, this.timeZone);
    const to = addZonedDays(from, 7, this.timeZone);
    return this.getCalendarRows(filter, { from, to }, [TaskStatus.PENDING]);
  }

  async getPreventiveCalendar(filter: AnalyticsFilterDto) {
    const period = this.period(filter);
    return this.getCalendarRows(
      filter,
      { from: period.from, to: period.toExclusive },
      undefined,
      500,
    );
  }

  async getMachineProfile(id: string, query: MachineProfileQueryDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("Invalid machine id");
    }

    const machine = (await this.machineModel
      .findOne({ _id: new Types.ObjectId(id), deletedAt: null })
      .populate("systemId", "name departmentIds")
      .lean()) as Record<string, any> | null;
    if (!machine) throw new NotFoundException("Machine not found");

    const now = new Date();
    const tomorrow = addZonedDays(
      startOfZonedDay(now, this.timeZone),
      1,
      this.timeZone,
    );
    const last30Start = addZonedDays(tomorrow, -30, this.timeZone);
    const last90Start = addZonedDays(tomorrow, -90, this.timeZone);
    const machineId = new Types.ObjectId(id);
    const requestMatch = { machineId, deletedAt: null };
    const skip = (query.page - 1) * query.limit;

    const [healthRows, contextRows, timelineRows, timelineTotal] =
      await Promise.all([
        this.requestModel.aggregate([
          { $match: requestMatch },
          {
            $group: {
              _id: null,
              totalMaintenance: { $sum: 1 },
              emergencyMaintenance: {
                $sum: {
                  $cond: [
                    { $eq: ["$maintenanceType", MaintenanceType.EMERGENCY] },
                    1,
                    0,
                  ],
                },
              },
              preventiveMaintenance: {
                $sum: {
                  $cond: [
                    { $eq: ["$maintenanceType", MaintenanceType.PREVENTIVE] },
                    1,
                    0,
                  ],
                },
              },
              lastMaintenanceAt: { $max: "$openedAt" },
              avgCompletionMs: {
                $avg: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$status", RequestStatus.COMPLETED] },
                        { $ne: [{ $type: "$closedAt" }, "missing"] },
                      ],
                    },
                    { $subtract: ["$closedAt", "$openedAt"] },
                    null,
                  ],
                },
              },
              failuresLast30Days: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        {
                          $eq: ["$maintenanceType", MaintenanceType.EMERGENCY],
                        },
                        { $gte: ["$openedAt", last30Start] },
                        { $lt: ["$openedAt", tomorrow] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              failuresLast90Days: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        {
                          $eq: ["$maintenanceType", MaintenanceType.EMERGENCY],
                        },
                        { $gte: ["$openedAt", last90Start] },
                        { $lt: ["$openedAt", tomorrow] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ]),
        this.requestModel.aggregate([
          { $match: requestMatch },
          { $sort: { openedAt: -1 } },
          { $limit: 1 },
          {
            $lookup: {
              from: "locations",
              localField: "locationId",
              foreignField: "_id",
              as: "location",
            },
          },
          {
            $lookup: {
              from: "departments",
              localField: "departmentId",
              foreignField: "_id",
              as: "department",
            },
          },
          {
            $project: {
              _id: 0,
              location: { $first: "$location.name" },
              department: { $first: "$department.name" },
            },
          },
        ]),
        this.requestModel
          .find(requestMatch)
          .select(
            "requestCode maintenanceType status openedAt closedAt stoppedAt engineerId reasonText",
          )
          .populate("engineerId", "name")
          .sort({ openedAt: -1 })
          .skip(skip)
          .limit(query.limit)
          .lean(),
        this.requestModel.countDocuments(requestMatch),
      ]);

    const health = healthRows[0] || {};
    const context = contextRows[0] || {};
    const system = machine.systemId as Record<string, any> | undefined;
    return {
      machine: {
        id: String(machine._id),
        name: machine.name,
        description: machine.description,
        system: system?.name || "-",
        department: context.department || null,
        location: context.location || null,
        components: machine.components || [],
      },
      health: {
        totalMaintenance: health.totalMaintenance || 0,
        emergencyMaintenance: health.emergencyMaintenance || 0,
        preventiveMaintenance: health.preventiveMaintenance || 0,
        lastMaintenanceAt: health.lastMaintenanceAt || null,
        avgCompletionTimeHours: this.toHours(health.avgCompletionMs),
        failuresLast30Days: health.failuresLast30Days || 0,
        failuresLast90Days: health.failuresLast90Days || 0,
      },
      timeline: timelineRows.map((request: Record<string, any>) => ({
        id: String(request._id),
        requestCode: request.requestCode,
        maintenanceType: request.maintenanceType,
        status: request.status,
        openedAt: request.openedAt,
        closedAt: request.closedAt,
        stoppedAt: request.stoppedAt,
        engineerName: request.engineerId?.name || null,
        reasonSummary:
          request.reasonText?.length > 180
            ? `${request.reasonText.slice(0, 180)}…`
            : request.reasonText,
      })),
      timelineMeta: {
        total: timelineTotal,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(timelineTotal / query.limit),
      },
      timezone: this.timeZone,
    };
  }

  async getRepeatFailureAnalytics(query: RepeatFailuresQueryDto) {
    const tomorrow = addZonedDays(
      startOfZonedDay(new Date(), this.timeZone),
      1,
      this.timeZone,
    );
    const currentFrom = addZonedDays(tomorrow, -query.days, this.timeZone);
    const previousFrom = addZonedDays(currentFrom, -query.days, this.timeZone);
    const match = this.requestMatch(query);
    match.maintenanceType = MaintenanceType.EMERGENCY;
    match.openedAt = { $gte: previousFrom, $lt: tomorrow };

    const rows = await this.requestModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$machineId",
          currentCount: {
            $sum: {
              $cond: [{ $gte: ["$openedAt", currentFrom] }, 1, 0],
            },
          },
          previousCount: {
            $sum: {
              $cond: [{ $lt: ["$openedAt", currentFrom] }, 1, 0],
            },
          },
          lastFailureAt: { $max: "$openedAt" },
        },
      },
      { $match: { currentCount: { $gte: 2 } } },
      {
        $lookup: {
          from: "machines",
          localField: "_id",
          foreignField: "_id",
          as: "machine",
        },
      },
      {
        $lookup: {
          from: "systems",
          localField: "machine.systemId",
          foreignField: "_id",
          as: "system",
        },
      },
      { $sort: { currentCount: -1, lastFailureAt: -1 } },
      { $limit: query.limit },
      {
        $project: {
          _id: 0,
          machineId: { $toString: "$_id" },
          machineName: { $ifNull: [{ $first: "$machine.name" }, "-"] },
          systemName: { $ifNull: [{ $first: "$system.name" }, "-"] },
          currentCount: 1,
          previousCount: 1,
          lastFailureAt: 1,
        },
      },
    ]);

    return {
      days: query.days,
      timezone: this.timeZone,
      currentFrom,
      currentToExclusive: tomorrow,
      previousFrom,
      previousToExclusive: currentFrom,
      machines: rows.map((row) => ({
        ...row,
        absoluteChange: row.currentCount - row.previousCount,
        percentChange:
          row.previousCount === 0
            ? null
            : this.round(
                ((row.currentCount - row.previousCount) / row.previousCount) *
                  100,
              ),
      })),
    };
  }

  async getRequestActivity(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("Invalid request id");
    }
    const logs = await this.auditLogModel
      .find({
        entity: "MaintenanceRequest",
        entityId: new Types.ObjectId(id),
      })
      .select("action userName createdAt changes")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return logs.map((log: Record<string, any>) => {
      const changes = (log.changes || {}) as Record<string, unknown>;
      const noteType = changes.consultantNotes
        ? "consultant"
        : changes.healthSafetyNotes
          ? "health_safety"
          : changes.projectManagerNotes
            ? "project_manager"
            : null;
      let summary = "تم تحديث الطلب";
      if (log.action === "create") summary = "تم إنشاء الطلب";
      else if (log.action === "soft_delete")
        summary = "نُقل الطلب إلى سلة المهملات";
      else if (log.action === "restore") summary = "تمت استعادة الطلب";
      else if (changes.status === RequestStatus.STOPPED)
        summary = "تم إيقاف الطلب";
      else if (changes.status === RequestStatus.COMPLETED)
        summary = "تم إكمال الطلب";
      else if (noteType) summary = "أُضيفت أو حُدثت ملاحظة";

      return {
        id: String(log._id),
        action: log.action,
        actorName: log.userName,
        createdAt: log.createdAt,
        summary,
        relevantChanges: {
          ...(typeof changes.status === "string"
            ? { status: changes.status }
            : {}),
          ...(typeof changes.maintenanceType === "string"
            ? { maintenanceType: changes.maintenanceType }
            : {}),
          ...(noteType ? { noteType } : {}),
        },
      };
    });
  }

  private async getRequestMetrics(
    filter: AnalyticsFilterDto,
    range: { from: Date; to: Date },
  ): Promise<RequestMetrics> {
    const now = new Date();
    const rows = await this.requestModel.aggregate([
      { $match: this.requestMatch(filter, range) },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          openRequests: {
            $sum: {
              $cond: [
                {
                  $in: [
                    "$status",
                    [RequestStatus.IN_PROGRESS, RequestStatus.STOPPED],
                  ],
                },
                1,
                0,
              ],
            },
          },
          emergencyRequests: {
            $sum: {
              $cond: [
                { $eq: ["$maintenanceType", MaintenanceType.EMERGENCY] },
                1,
                0,
              ],
            },
          },
          emergencyOpen: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$maintenanceType", MaintenanceType.EMERGENCY] },
                    { $ne: ["$status", RequestStatus.COMPLETED] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          stoppedRequests: {
            $sum: {
              $cond: [{ $eq: ["$status", RequestStatus.STOPPED] }, 1, 0],
            },
          },
          completedRequests: {
            $sum: {
              $cond: [{ $eq: ["$status", RequestStatus.COMPLETED] }, 1, 0],
            },
          },
          preventiveRequests: {
            $sum: {
              $cond: [
                { $eq: ["$maintenanceType", MaintenanceType.PREVENTIVE] },
                1,
                0,
              ],
            },
          },
          avgCompletionMs: {
            $avg: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", RequestStatus.COMPLETED] },
                    { $ne: [{ $type: "$closedAt" }, "missing"] },
                  ],
                },
                { $subtract: ["$closedAt", "$openedAt"] },
                null,
              ],
            },
          },
          minCompletionMs: {
            $min: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", RequestStatus.COMPLETED] },
                    { $ne: [{ $type: "$closedAt" }, "missing"] },
                  ],
                },
                { $subtract: ["$closedAt", "$openedAt"] },
                null,
              ],
            },
          },
          maxCompletionMs: {
            $max: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", RequestStatus.COMPLETED] },
                    { $ne: [{ $type: "$closedAt" }, "missing"] },
                  ],
                },
                { $subtract: ["$closedAt", "$openedAt"] },
                null,
              ],
            },
          },
          avgOpenAgeMs: {
            $avg: {
              $cond: [
                {
                  $in: [
                    "$status",
                    [RequestStatus.IN_PROGRESS, RequestStatus.STOPPED],
                  ],
                },
                { $subtract: [now, "$openedAt"] },
                null,
              ],
            },
          },
        },
      },
    ]);

    const row = rows[0] || {};
    const total = row.totalRequests || 0;
    const emergency = row.emergencyRequests || 0;
    const preventive = row.preventiveRequests || 0;
    return {
      totalRequests: total,
      openRequests: row.openRequests || 0,
      emergencyRequests: emergency,
      emergencyOpen: row.emergencyOpen || 0,
      stoppedRequests: row.stoppedRequests || 0,
      completedRequests: row.completedRequests || 0,
      preventiveRequests: preventive,
      avgCompletionTimeHours: this.toHours(row.avgCompletionMs),
      minCompletionTimeHours: this.toHours(row.minCompletionMs),
      maxCompletionTimeHours: this.toHours(row.maxCompletionMs),
      openRequestAverageAgeHours: this.toHours(row.avgOpenAgeMs),
      completionRate: this.percent(row.completedRequests || 0, total),
      stopRate: this.percent(row.stoppedRequests || 0, total),
      emergencyPreventiveRatio:
        preventive > 0 ? this.round(emergency / preventive) : null,
    };
  }

  private async getCurrentRequestSnapshot(
    filter: AnalyticsFilterDto,
  ): Promise<CurrentRequestSnapshot> {
    const now = new Date();
    const match = this.requestMatch(filter);
    match.status = { $in: [...OPEN_REQUEST_STATUSES] };
    const rows = await this.requestModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          openRequests: { $sum: 1 },
          emergencyOpen: {
            $sum: {
              $cond: [
                { $eq: ["$maintenanceType", MaintenanceType.EMERGENCY] },
                1,
                0,
              ],
            },
          },
          stoppedRequests: {
            $sum: {
              $cond: [{ $eq: ["$status", RequestStatus.STOPPED] }, 1, 0],
            },
          },
          avgOpenAgeMs: {
            $avg: { $subtract: [now, "$openedAt"] },
          },
        },
      },
    ]);
    const row = rows[0] || {};
    return {
      openRequests: row.openRequests || 0,
      emergencyOpen: row.emergencyOpen || 0,
      stoppedRequests: row.stoppedRequests || 0,
      openRequestAverageAgeHours: this.toHours(row.avgOpenAgeMs),
    };
  }

  private async getPreventiveSummaryForRange(
    filter: AnalyticsFilterDto,
    range: { from: Date; to: Date },
  ): Promise<PreventiveSummary> {
    const now = new Date();
    const todayStart = startOfZonedDay(now, this.timeZone);
    const tomorrowStart = addZonedDays(todayStart, 1, this.timeZone);
    const dueCutoff = range.to < tomorrowStart ? range.to : tomorrowStart;
    const rows = await this.taskModel.aggregate([
      { $match: this.taskMatch(filter) },
      { $addFields: { scheduledDate: this.scheduledDateExpression() } },
      { $match: { scheduledDate: { $gte: range.from, $lt: range.to } } },
      {
        $group: {
          _id: null,
          scheduled: { $sum: 1 },
          scheduledDue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$status", TaskStatus.CANCELLED] },
                    { $lt: ["$scheduledDate", dueCutoff] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          completed: {
            $sum: { $cond: [{ $eq: ["$status", TaskStatus.COMPLETED] }, 1, 0] },
          },
          completedDue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", TaskStatus.COMPLETED] },
                    { $lt: ["$scheduledDate", dueCutoff] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          overdue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $lt: ["$scheduledDate", dueCutoff] },
                    {
                      $not: [
                        {
                          $in: [
                            "$status",
                            [TaskStatus.COMPLETED, TaskStatus.CANCELLED],
                          ],
                        },
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
          cancelled: {
            $sum: { $cond: [{ $eq: ["$status", TaskStatus.CANCELLED] }, 1, 0] },
          },
        },
      },
    ]);
    const row = rows[0] || {};
    return {
      scheduled: row.scheduled || 0,
      scheduledDue: row.scheduledDue || 0,
      completed: row.completed || 0,
      overdue: row.overdue || 0,
      cancelled: row.cancelled || 0,
      compliancePercent:
        row.scheduledDue > 0
          ? this.percent(row.completedDue || 0, row.scheduledDue)
          : null,
    };
  }

  private async countCurrentOverduePreventive(filter: AnalyticsFilterDto) {
    const tomorrowStart = addZonedDays(
      startOfZonedDay(new Date(), this.timeZone),
      1,
      this.timeZone,
    );
    const rows = await this.taskModel.aggregate([
      { $match: this.taskMatch(filter) },
      { $addFields: { scheduledDate: this.scheduledDateExpression() } },
      {
        $match: {
          scheduledDate: { $lt: tomorrowStart },
          status: { $nin: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
        },
      },
      { $count: "count" },
    ]);
    return rows[0]?.count || 0;
  }

  private async countUpcomingPreventive(filter: AnalyticsFilterDto) {
    const from = startOfZonedDay(new Date(), this.timeZone);
    const to = addZonedDays(from, 7, this.timeZone);
    const rows = await this.taskModel.aggregate([
      { $match: { ...this.taskMatch(filter), status: TaskStatus.PENDING } },
      { $addFields: { scheduledDate: this.scheduledDateExpression() } },
      { $match: { scheduledDate: { $gte: from, $lt: to } } },
      { $count: "count" },
    ]);
    return rows[0]?.count || 0;
  }

  private async getCalendarRows(
    filter: AnalyticsFilterDto,
    range: { from: Date; to: Date },
    statuses?: TaskStatus[],
    limit = 100,
  ) {
    const now = new Date();
    const dueCutoff = addZonedDays(
      startOfZonedDay(now, this.timeZone),
      1,
      this.timeZone,
    );
    const match = this.taskMatch(filter);
    if (statuses) match.status = { $in: statuses };
    return this.taskModel.aggregate([
      { $match: match },
      { $addFields: { scheduledDate: this.scheduledDateExpression() } },
      { $match: { scheduledDate: { $gte: range.from, $lt: range.to } } },
      { $sort: { scheduledDate: 1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "engineerId",
          foreignField: "_id",
          as: "engineer",
        },
      },
      {
        $lookup: {
          from: "locations",
          localField: "locationId",
          foreignField: "_id",
          as: "location",
        },
      },
      {
        $lookup: {
          from: "departments",
          localField: "departmentId",
          foreignField: "_id",
          as: "department",
        },
      },
      {
        $lookup: {
          from: "systems",
          localField: "systemId",
          foreignField: "_id",
          as: "system",
        },
      },
      {
        $lookup: {
          from: "machines",
          localField: "machineId",
          foreignField: "_id",
          as: "machine",
        },
      },
      {
        $project: {
          _id: 0,
          id: { $toString: "$_id" },
          taskCode: 1,
          title: 1,
          date: "$scheduledDate",
          status: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", TaskStatus.PENDING] },
                  { $lt: ["$scheduledDate", dueCutoff] },
                ],
              },
              TaskStatus.OVERDUE,
              "$status",
            ],
          },
          engineer: { $ifNull: [{ $first: "$engineer.name" }, null] },
          location: { $ifNull: [{ $first: "$location.name" }, "-"] },
          department: { $ifNull: [{ $first: "$department.name" }, "-"] },
          system: { $ifNull: [{ $first: "$system.name" }, "-"] },
          machine: { $ifNull: [{ $first: "$machine.name" }, "-"] },
        },
      },
    ]);
  }

  private async getRepeatFailures(
    filter: AnalyticsFilterDto,
    range: { from: Date; to: Date },
    limit: number,
  ) {
    const match = this.requestMatch(filter, range);
    match.maintenanceType = MaintenanceType.EMERGENCY;
    const machines = await this.requestModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$machineId",
          failureCount: { $sum: 1 },
          lastFailure: { $max: "$openedAt" },
        },
      },
      { $match: { failureCount: { $gte: 2 } } },
      {
        $lookup: {
          from: "machines",
          localField: "_id",
          foreignField: "_id",
          as: "machine",
        },
      },
      {
        $lookup: {
          from: "systems",
          localField: "machine.systemId",
          foreignField: "_id",
          as: "system",
        },
      },
      {
        $project: {
          _id: 0,
          machineId: { $toString: "$_id" },
          machineName: { $ifNull: [{ $first: "$machine.name" }, "-"] },
          systemName: { $ifNull: [{ $first: "$system.name" }, "-"] },
          failureCount: 1,
          lastFailure: 1,
        },
      },
      { $sort: { failureCount: -1, lastFailure: -1 } },
    ]);
    return {
      totalMachines: machines.length,
      machines: machines.slice(0, limit),
    };
  }

  private async countUnresolvedComplaints(filter: AnalyticsFilterDto) {
    // Complaint schema has textual locations, so only its compatible engineer filter is applied.
    return this.complaintModel.countDocuments({
      deletedAt: null,
      status: { $in: [ComplaintStatus.NEW, ComplaintStatus.IN_PROGRESS] },
      ...(filter.engineerId
        ? { assignedEngineerId: new Types.ObjectId(filter.engineerId) }
        : {}),
    });
  }

  private async getDistribution(
    filter: AnalyticsFilterDto,
    range: { from: Date; to: Date },
    field: "status" | "maintenanceType",
  ) {
    const rows = await this.requestModel.aggregate([
      { $match: this.requestMatch(filter, range) },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $project: { _id: 0, key: "$_id", count: 1 } },
      { $sort: { count: -1 } },
    ]);
    return rows;
  }

  private async getTrends(
    filter: AnalyticsFilterDto,
    granularity: "daily" | "weekly" | "monthly",
  ) {
    const period = this.period(filter);
    const format =
      granularity === "monthly"
        ? "%Y-%m"
        : granularity === "weekly"
          ? "%G-W%V"
          : "%Y-%m-%d";
    return this.requestModel.aggregate([
      {
        $match: this.requestMatch(filter, {
          from: period.from,
          to: period.toExclusive,
        }),
      },
      {
        $group: {
          _id: {
            $dateToString: {
              date: "$openedAt",
              format,
              timezone: this.timeZone,
            },
          },
          total: { $sum: 1 },
          emergency: {
            $sum: {
              $cond: [
                { $eq: ["$maintenanceType", MaintenanceType.EMERGENCY] },
                1,
                0,
              ],
            },
          },
          preventive: {
            $sum: {
              $cond: [
                { $eq: ["$maintenanceType", MaintenanceType.PREVENTIVE] },
                1,
                0,
              ],
            },
          },
          completed: {
            $sum: {
              $cond: [{ $eq: ["$status", RequestStatus.COMPLETED] }, 1, 0],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          period: "$_id",
          total: 1,
          emergency: 1,
          preventive: 1,
          completed: 1,
        },
      },
      { $sort: { period: 1 } },
    ]);
  }

  private async getRanking(
    filter: AnalyticsFilterDto,
    range: { from: Date; to: Date },
    field:
      | "engineerId"
      | "departmentId"
      | "locationId"
      | "systemId"
      | "machineId",
    collection: string,
  ) {
    return this.requestModel.aggregate([
      { $match: this.requestMatch(filter, range) },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: collection,
          localField: "_id",
          foreignField: "_id",
          as: "entity",
        },
      },
      {
        $project: {
          _id: 0,
          id: { $toString: "$_id" },
          name: { $ifNull: [{ $first: "$entity.name" }, "غير محدد"] },
          count: 1,
        },
      },
    ]);
  }

  private requestMatch(
    filter: AnalyticsFilterDto,
    range?: { from: Date; to: Date },
  ): Record<string, any> {
    const match: Record<string, any> = { deletedAt: null };
    this.addIdFilters(match, filter);
    if (range) match.createdAt = { $gte: range.from, $lt: range.to };
    return match;
  }

  private taskMatch(filter: AnalyticsFilterDto): Record<string, any> {
    const match: Record<string, any> = { deletedAt: null };
    this.addIdFilters(match, filter);
    return match;
  }

  private addIdFilters(match: Record<string, any>, filter: AnalyticsFilterDto) {
    for (const field of [
      "locationId",
      "departmentId",
      "systemId",
      "machineId",
      "engineerId",
    ] as const) {
      if (filter[field]) match[field] = new Types.ObjectId(filter[field]);
    }
  }

  private scheduledDateExpression() {
    return {
      $dateFromParts: {
        year: "$scheduledYear",
        month: "$scheduledMonth",
        day: { $ifNull: ["$scheduledDay", 1] },
        timezone: this.timeZone,
      },
    };
  }

  private period(filter: AnalyticsFilterDto): AnalyticsPeriod {
    const period = resolveAnalyticsPeriod(
      filter.fromDate,
      filter.toDate,
      this.timeZone,
    );
    if (period.toExclusive <= period.from) {
      throw new BadRequestException("toDate must be on or after fromDate");
    }
    return period;
  }

  private serialisePeriod(period: AnalyticsPeriod) {
    return {
      from: period.from.toISOString(),
      toExclusive: period.toExclusive.toISOString(),
      previousFrom: period.previousFrom.toISOString(),
      previousToExclusive: period.previousToExclusive.toISOString(),
    };
  }

  private comparison(
    current: number | null,
    previous: number | null,
  ): PeriodComparison {
    if (current === null || previous === null) {
      return {
        current: current ?? 0,
        previous: previous ?? 0,
        absoluteChange: 0,
        percentChange: null,
        comparable: false,
      };
    }
    return {
      current: this.round(current),
      previous: this.round(previous),
      absoluteChange: this.round(current - previous),
      percentChange:
        previous === 0
          ? null
          : this.round(((current - previous) / previous) * 100),
      comparable: previous !== 0,
    };
  }

  private topIds(
    rows: Array<Record<string, any>>,
    field: string,
    limit: number,
  ) {
    const totals = new Map<string, number>();
    for (const row of rows)
      totals.set(row[field], (totals.get(row[field]) || 0) + row.count);
    return new Set(
      [...totals.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([id]) => id),
    );
  }

  private toHours(value?: number | null) {
    return value ? this.round(value / HOUR_MS) : 0;
  }

  private percent(value: number, total: number) {
    return total > 0 ? this.round((value / total) * 100) : 0;
  }

  private round(value: number) {
    return Math.round(value * 10) / 10;
  }

  private async cached<T>(
    namespace: string,
    filter: object,
    factory: () => Promise<T>,
  ) {
    const cacheKey = `analytics:${namespace}:${this.timeZone}:${JSON.stringify(filter)}`;
    const cached = await this.cacheManager.get<T>(cacheKey);
    if (cached) return cached;
    const value = await factory();
    await this.cacheManager.set(cacheKey, value, CACHE_TTL);
    return value;
  }
}
