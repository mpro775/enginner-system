import { Injectable, Inject } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { Model, PipelineStage, Types } from "mongoose";
import {
  MaintenanceRequest,
  MaintenanceRequestDocument,
} from "../maintenance-requests/schemas/maintenance-request.schema";
import {
  StatisticsFilterDto,
  TrendsFilterDto,
} from "./dto/statistics-filter.dto";
import { RequestStatus, MaintenanceType, Role } from "../../common/enums";
import { normalizedReferenceIdExpression } from "../../common/utils/reference-id.util";
import { CurrentUserData } from "../../common/decorators/current-user.decorator";
import {
  assertDepartmentAccess,
  getDepartmentMatchValues,
  getScopeCacheKey,
  stableSerialize,
} from "../../common/utils/access-scope.util";
import { ForbiddenAccessException } from "../../common/exceptions";

const CACHE_TTL = 60000; // 1 minute

export interface DashboardStatistics {
  totalRequests: number;
  inProgress: number;
  pendingConsultantApproval: number;
  completed: number;
  stopped: number;
  emergencyRequests: number;
  preventiveRequests: number;
  todayRequests: number;
  thisWeekRequests: number;
  thisMonthRequests: number;
  avgCompletionTimeHours: number;
}

export interface EngineerStatistics {
  engineerId: string;
  engineerName: string;
  totalRequests: number;
  byStatus: {
    inProgress: number;
    pendingConsultantApproval: number;
    completed: number;
    stopped: number;
  };
  byType: {
    emergency: number;
    preventive: number;
  };
  avgCompletionTimeHours: number;
}

export interface TopFailingMachine {
  machineId: string;
  machineName: string;
  systemName: string;
  failureCount: number;
  lastFailure: Date;
}

export interface TrendData {
  period: string;
  total: number;
  emergency: number;
  preventive: number;
  completed: number;
  pendingConsultantApproval: number;
}

@Injectable()
export class StatisticsService {
  constructor(
    @InjectModel(MaintenanceRequest.name)
    private requestModel: Model<MaintenanceRequestDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getDashboardStatistics(
    filter: StatisticsFilterDto,
    user: CurrentUserData,
  ): Promise<DashboardStatistics> {
    const cacheKey = this.buildStatisticsCacheKey("dashboard", filter, user);
    const cached = await this.cacheManager.get<DashboardStatistics>(cacheKey);
    if (cached) return cached;

    const matchStage = await this.buildMatchStage(filter, user);
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      statusCounts,
      typeCounts,
      todayCount,
      weekCount,
      monthCount,
      avgCompletionTime,
    ] = await Promise.all([
      this.requestModel.aggregate([
        { $match: matchStage },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      this.requestModel.aggregate([
        { $match: matchStage },
        { $group: { _id: "$maintenanceType", count: { $sum: 1 } } },
      ]),
      this.requestModel.countDocuments({
        ...matchStage,
        createdAt: { $gte: todayStart },
      }),
      this.requestModel.countDocuments({
        ...matchStage,
        createdAt: { $gte: weekStart },
      }),
      this.requestModel.countDocuments({
        ...matchStage,
        createdAt: { $gte: monthStart },
      }),
      this.requestModel.aggregate([
        {
          $match: {
            ...matchStage,
            status: RequestStatus.COMPLETED,
            closedAt: { $exists: true },
          },
        },
        {
          $project: {
            completionTime: {
              $subtract: ["$closedAt", "$openedAt"],
            },
          },
        },
        {
          $group: {
            _id: null,
            avgTime: { $avg: "$completionTime" },
          },
        },
      ]),
    ]);

    const statusMap = statusCounts.reduce(
      (acc, curr) => ({ ...acc, [curr._id]: curr.count }),
      {},
    );
    const typeMap = typeCounts.reduce(
      (acc, curr) => ({ ...acc, [curr._id]: curr.count }),
      {},
    );

    const result: DashboardStatistics = {
      totalRequests:
        (statusMap[RequestStatus.IN_PROGRESS] || 0) +
        (statusMap[RequestStatus.PENDING_CONSULTANT_APPROVAL] || 0) +
        (statusMap[RequestStatus.COMPLETED] || 0) +
        (statusMap[RequestStatus.STOPPED] || 0),
      inProgress: statusMap[RequestStatus.IN_PROGRESS] || 0,
      pendingConsultantApproval:
        statusMap[RequestStatus.PENDING_CONSULTANT_APPROVAL] || 0,
      completed: statusMap[RequestStatus.COMPLETED] || 0,
      stopped: statusMap[RequestStatus.STOPPED] || 0,
      emergencyRequests: typeMap[MaintenanceType.EMERGENCY] || 0,
      preventiveRequests: typeMap[MaintenanceType.PREVENTIVE] || 0,
      todayRequests: todayCount,
      thisWeekRequests: weekCount,
      thisMonthRequests: monthCount,
      avgCompletionTimeHours: avgCompletionTime[0]?.avgTime
        ? Math.round((avgCompletionTime[0].avgTime / (1000 * 60 * 60)) * 10) /
          10
        : 0,
    };

    await this.cacheManager.set(cacheKey, result, CACHE_TTL);
    return result;
  }

  async getByEngineer(
    filter: StatisticsFilterDto,
    user: CurrentUserData,
  ): Promise<EngineerStatistics[]> {
    const cacheKey = this.buildStatisticsCacheKey("byEngineer", filter, user);
    const cached = await this.cacheManager.get<EngineerStatistics[]>(cacheKey);
    if (cached) return cached;

    const matchStage = await this.buildMatchStage(filter, user);

    const stats = await this.requestModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$engineerId",
          total: { $sum: 1 },
          inProgress: {
            $sum: {
              $cond: [{ $eq: ["$status", RequestStatus.IN_PROGRESS] }, 1, 0],
            },
          },
          pendingConsultantApproval: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    "$status",
                    RequestStatus.PENDING_CONSULTANT_APPROVAL,
                  ],
                },
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
          stopped: {
            $sum: {
              $cond: [{ $eq: ["$status", RequestStatus.STOPPED] }, 1, 0],
            },
          },
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
          completedRequests: {
            $push: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", RequestStatus.COMPLETED] },
                    { $ifNull: ["$closedAt", false] },
                  ],
                },
                { openedAt: "$openedAt", closedAt: "$closedAt" },
                null,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "engineer",
        },
      },
      {
        $unwind: {
          path: "$engineer",
          preserveNullAndEmptyArrays: true,
        },
      },
      { $sort: { total: -1 } },
    ]);

    const result: EngineerStatistics[] = stats.map((stat) => {
      const completedWithTime = stat.completedRequests.filter(
        (r: any) => r !== null,
      );
      let avgTime = 0;
      if (completedWithTime.length > 0) {
        const totalTime = completedWithTime.reduce(
          (acc: number, r: any) =>
            acc +
            (new Date(r.closedAt).getTime() - new Date(r.openedAt).getTime()),
          0,
        );
        avgTime = totalTime / completedWithTime.length / (1000 * 60 * 60);
      }

      return {
        engineerId: stat._id.toString(),
        engineerName: stat.engineer?.name || "مرجع غير متاح",
        totalRequests: stat.total,
        byStatus: {
          inProgress: stat.inProgress,
          pendingConsultantApproval: stat.pendingConsultantApproval,
          completed: stat.completed,
          stopped: stat.stopped,
        },
        byType: {
          emergency: stat.emergency,
          preventive: stat.preventive,
        },
        avgCompletionTimeHours: Math.round(avgTime * 10) / 10,
      };
    });

    await this.cacheManager.set(cacheKey, result, CACHE_TTL);
    return result;
  }

  async getByStatus(
    filter: StatisticsFilterDto,
    user: CurrentUserData,
  ): Promise<Record<string, number>> {
    const matchStage = await this.buildMatchStage(filter, user);
    const stats = await this.requestModel.aggregate([
      { $match: matchStage },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    return stats.reduce(
      (acc, curr) => ({ ...acc, [curr._id]: curr.count }),
      {},
    );
  }

  async getByMaintenanceType(
    filter: StatisticsFilterDto,
    user: CurrentUserData,
  ): Promise<Record<string, number>> {
    const matchStage = await this.buildMatchStage(filter, user);
    const stats = await this.requestModel.aggregate([
      { $match: matchStage },
      { $group: { _id: "$maintenanceType", count: { $sum: 1 } } },
    ]);

    return stats.reduce(
      (acc, curr) => ({ ...acc, [curr._id]: curr.count }),
      {},
    );
  }

  async getByLocation(filter: StatisticsFilterDto): Promise<any[]> {
    const matchStage = await this.buildMatchStage(filter);
    return this.requestModel.aggregate([
      { $match: matchStage },
      {
        $set: {
          normalizedLocationId: normalizedReferenceIdExpression("$locationId"),
        },
      },
      { $group: { _id: "$normalizedLocationId", count: { $sum: 1 } } },
      {
        $lookup: {
          from: "locations",
          localField: "_id",
          foreignField: "_id",
          as: "location",
        },
      },
      {
        $unwind: {
          path: "$location",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          locationId: "$_id",
          locationName: { $ifNull: ["$location.name", "مرجع غير متاح"] },
          count: 1,
        },
      },
      { $sort: { count: -1 } },
    ]);
  }

  async getByDepartment(filter: StatisticsFilterDto): Promise<any[]> {
    const matchStage = await this.buildMatchStage(filter);
    return this.requestModel.aggregate([
      { $match: matchStage },
      {
        $set: {
          normalizedDepartmentId:
            normalizedReferenceIdExpression("$departmentId"),
        },
      },
      { $group: { _id: "$normalizedDepartmentId", count: { $sum: 1 } } },
      {
        $lookup: {
          from: "departments",
          localField: "_id",
          foreignField: "_id",
          as: "department",
        },
      },
      {
        $unwind: {
          path: "$department",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          departmentId: "$_id",
          departmentName: {
            $ifNull: ["$department.name", "مرجع غير متاح"],
          },
          count: 1,
        },
      },
      { $sort: { count: -1 } },
    ]);
  }

  async getBySystem(filter: StatisticsFilterDto): Promise<any[]> {
    const matchStage = await this.buildMatchStage(filter);
    return this.requestModel.aggregate([
      { $match: matchStage },
      {
        $set: {
          normalizedSystemId: normalizedReferenceIdExpression("$systemId"),
        },
      },
      { $group: { _id: "$normalizedSystemId", count: { $sum: 1 } } },
      {
        $lookup: {
          from: "systems",
          localField: "_id",
          foreignField: "_id",
          as: "system",
        },
      },
      {
        $unwind: {
          path: "$system",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          systemId: "$_id",
          systemName: { $ifNull: ["$system.name", "مرجع غير متاح"] },
          count: 1,
        },
      },
      { $sort: { count: -1 } },
    ]);
  }

  async getTopFailingMachines(
    filter: StatisticsFilterDto,
    limit: number = 10,
  ): Promise<TopFailingMachine[]> {
    const matchStage = await this.buildMatchStage(filter);
    matchStage.maintenanceType = MaintenanceType.EMERGENCY;
    const stats = await this.requestModel.aggregate([
      { $match: matchStage },
      {
        $set: {
          normalizedMachineId: normalizedReferenceIdExpression("$machineId"),
        },
      },
      {
        $group: {
          _id: "$normalizedMachineId",
          failureCount: { $sum: 1 },
          lastFailure: { $max: "$createdAt" },
        },
      },
      {
        $lookup: {
          from: "machines",
          localField: "_id",
          foreignField: "_id",
          as: "machine",
        },
      },
      {
        $unwind: {
          path: "$machine",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $set: {
          normalizedMachineSystemId:
            normalizedReferenceIdExpression("$machine.systemId"),
        },
      },
      {
        $lookup: {
          from: "systems",
          localField: "normalizedMachineSystemId",
          foreignField: "_id",
          as: "system",
        },
      },
      {
        $unwind: {
          path: "$system",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          machineId: "$_id",
          machineName: { $ifNull: ["$machine.name", "مرجع غير متاح"] },
          systemName: { $ifNull: ["$system.name", "مرجع غير متاح"] },
          failureCount: 1,
          lastFailure: 1,
        },
      },
      { $sort: { failureCount: -1 } },
      { $limit: limit },
    ]);

    return stats;
  }

  async getTrends(filter: TrendsFilterDto): Promise<TrendData[]> {
    const matchStage = await this.buildMatchStage(filter);

    let dateFormat: string;
    switch (filter.period) {
      case "daily":
        dateFormat = "%Y-%m-%d";
        break;
      case "weekly":
        dateFormat = "%Y-W%V";
        break;
      case "monthly":
      default:
        dateFormat = "%Y-%m";
    }

    const pipeline: PipelineStage[] = [
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: "$createdAt" } },
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
          pendingConsultantApproval: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    "$status",
                    RequestStatus.PENDING_CONSULTANT_APPROVAL,
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const stats = await this.requestModel.aggregate(pipeline);

    return stats.map((stat) => ({
      period: stat._id,
      total: stat.total,
      emergency: stat.emergency,
      preventive: stat.preventive,
      completed: stat.completed,
      pendingConsultantApproval: stat.pendingConsultantApproval,
    }));
  }

  async getResponseTime(filter: StatisticsFilterDto): Promise<{
    avgCompletionTimeHours: number;
    minCompletionTimeHours: number;
    maxCompletionTimeHours: number;
  }> {
    const matchStage = await this.buildMatchStage(filter);

    const stats = await this.requestModel.aggregate([
      {
        $match: {
          ...matchStage,
          status: RequestStatus.COMPLETED,
          closedAt: { $exists: true },
        },
      },
      {
        $project: {
          completionTime: { $subtract: ["$closedAt", "$openedAt"] },
        },
      },
      {
        $group: {
          _id: null,
          avgCompletionTime: { $avg: "$completionTime" },
          minCompletionTime: { $min: "$completionTime" },
          maxCompletionTime: { $max: "$completionTime" },
        },
      },
    ]);

    const result = stats[0] || {};
    const toHours = (ms: number | null) =>
      ms ? Math.round((ms / (1000 * 60 * 60)) * 10) / 10 : 0;

    return {
      avgCompletionTimeHours: toHours(result.avgCompletionTime),
      minCompletionTimeHours: toHours(result.minCompletionTime),
      maxCompletionTimeHours: toHours(result.maxCompletionTime),
    };
  }

  private async buildMatchStage(
    filter: StatisticsFilterDto,
    user?: CurrentUserData,
  ): Promise<Record<string, any>> {
    const matchStage: Record<string, any> = { deletedAt: null };

    // Engineers can only see their own statistics
    if (user?.role === Role.ENGINEER) {
      // Support both String and ObjectId formats
      matchStage.engineerId = {
        $in: [
          user.userId,
          Types.ObjectId.isValid(user.userId)
            ? new Types.ObjectId(user.userId)
            : null,
        ].filter(Boolean),
      } as any;
    }

    // Consultants can only see statistics from their departments
    if (user?.role === Role.CONSULTANT) {
      if (filter.departmentId) assertDepartmentAccess(user, filter.departmentId);
      matchStage.departmentId = filter.departmentId
        ? {
            $in: [
              filter.departmentId,
              new Types.ObjectId(filter.departmentId),
            ],
          }
        : { $in: getDepartmentMatchValues(user) };
    }

    if (filter.engineerId) {
      if (
        user?.role === Role.ENGINEER &&
        filter.engineerId !== user.userId
      ) {
        throw new ForbiddenAccessException(
          "Engineer is outside your assigned scope",
        );
      }
      // Support both String and ObjectId formats
      matchStage.engineerId = {
        $in: [
          filter.engineerId,
          Types.ObjectId.isValid(filter.engineerId)
            ? new Types.ObjectId(filter.engineerId)
            : null,
        ].filter(Boolean),
      } as any;
    }

    if (filter.locationId) {
      // Support both String and ObjectId formats
      matchStage.locationId = {
        $in: [
          filter.locationId,
          Types.ObjectId.isValid(filter.locationId)
            ? new Types.ObjectId(filter.locationId)
            : null,
        ].filter(Boolean),
      } as any;
    }

    if (filter.departmentId && user?.role !== Role.CONSULTANT) {
      // Support both String and ObjectId formats
      matchStage.departmentId = {
        $in: [
          filter.departmentId,
          Types.ObjectId.isValid(filter.departmentId)
            ? new Types.ObjectId(filter.departmentId)
            : null,
        ].filter(Boolean),
      } as any;
    }

    if (filter.systemId) {
      // Support both String and ObjectId formats
      matchStage.systemId = {
        $in: [
          filter.systemId,
          Types.ObjectId.isValid(filter.systemId)
            ? new Types.ObjectId(filter.systemId)
            : null,
        ].filter(Boolean),
      } as any;
    }

    if (filter.maintenanceType) {
      matchStage.maintenanceType = filter.maintenanceType;
    }

    if (filter.fromDate || filter.toDate) {
      matchStage.createdAt = {};
      if (filter.fromDate) {
        matchStage.createdAt.$gte = new Date(filter.fromDate);
      }
      if (filter.toDate) {
        matchStage.createdAt.$lte = new Date(filter.toDate);
      }
    }

    return matchStage;
  }

  private buildStatisticsCacheKey(
    namespace: string,
    filter: StatisticsFilterDto,
    user: CurrentUserData,
  ): string {
    return `stats:${namespace}:${getScopeCacheKey(user)}:${stableSerialize(filter)}`;
  }
}
