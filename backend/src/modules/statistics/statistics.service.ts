import { Injectable, Inject } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { Model, PipelineStage, Types } from "mongoose";
import {
  MaintenanceRequest,
  MaintenanceRequestDocument,
} from "../maintenance-requests/schemas/maintenance-request.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import {
  StatisticsFilterDto,
  TrendsFilterDto,
} from "./dto/statistics-filter.dto";
import { RequestStatus, MaintenanceType, Role } from "../../common/enums";

const CACHE_TTL = 60000; // 1 minute

export interface DashboardStatistics {
  totalRequests: number;
  inProgress: number;
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
}

@Injectable()
export class StatisticsService {
  constructor(
    @InjectModel(MaintenanceRequest.name)
    private requestModel: Model<MaintenanceRequestDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {}

  async getDashboardStatistics(
    filter: StatisticsFilterDto,
    userRole: string,
    userId?: string
  ): Promise<DashboardStatistics> {
    const cacheKey = `stats:dashboard:${JSON.stringify(filter)}:${userRole}:${userId}`;
    const cached = await this.cacheManager.get<DashboardStatistics>(cacheKey);
    if (cached) return cached;

    const matchStage = await this.buildMatchStage(filter, userRole, userId);
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
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
      {}
    );
    const typeMap = typeCounts.reduce(
      (acc, curr) => ({ ...acc, [curr._id]: curr.count }),
      {}
    );

    const result: DashboardStatistics = {
      totalRequests:
        (statusMap[RequestStatus.IN_PROGRESS] || 0) +
        (statusMap[RequestStatus.COMPLETED] || 0) +
        (statusMap[RequestStatus.STOPPED] || 0),
      inProgress: statusMap[RequestStatus.IN_PROGRESS] || 0,
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
    filter: StatisticsFilterDto
  ): Promise<EngineerStatistics[]> {
    const cacheKey = `stats:byEngineer:${JSON.stringify(filter)}`;
    const cached = await this.cacheManager.get<EngineerStatistics[]>(cacheKey);
    if (cached) return cached;

    const matchStage = await this.buildMatchStage(filter);

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
      { $unwind: "$engineer" },
      { $sort: { total: -1 } },
    ]);

    const result: EngineerStatistics[] = stats.map((stat) => {
      const completedWithTime = stat.completedRequests.filter(
        (r: any) => r !== null
      );
      let avgTime = 0;
      if (completedWithTime.length > 0) {
        const totalTime = completedWithTime.reduce(
          (acc: number, r: any) =>
            acc +
            (new Date(r.closedAt).getTime() - new Date(r.openedAt).getTime()),
          0
        );
        avgTime = totalTime / completedWithTime.length / (1000 * 60 * 60);
      }

      return {
        engineerId: stat._id.toString(),
        engineerName: stat.engineer.name,
        totalRequests: stat.total,
        byStatus: {
          inProgress: stat.inProgress,
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
    filter: StatisticsFilterDto
  ): Promise<Record<string, number>> {
    const matchStage = await this.buildMatchStage(filter);
    const stats = await this.requestModel.aggregate([
      { $match: matchStage },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    return stats.reduce(
      (acc, curr) => ({ ...acc, [curr._id]: curr.count }),
      {}
    );
  }

  async getByMaintenanceType(
    filter: StatisticsFilterDto
  ): Promise<Record<string, number>> {
    const matchStage = await this.buildMatchStage(filter);
    const stats = await this.requestModel.aggregate([
      { $match: matchStage },
      { $group: { _id: "$maintenanceType", count: { $sum: 1 } } },
    ]);

    return stats.reduce(
      (acc, curr) => ({ ...acc, [curr._id]: curr.count }),
      {}
    );
  }

  async getByLocation(filter: StatisticsFilterDto): Promise<any[]> {
    const matchStage = await this.buildMatchStage(filter);
    return this.requestModel.aggregate([
      { $match: matchStage },
      { $group: { _id: "$locationId", count: { $sum: 1 } } },
      {
        $lookup: {
          from: "locations",
          localField: "_id",
          foreignField: "_id",
          as: "location",
        },
      },
      { $unwind: "$location" },
      {
        $project: {
          locationId: "$_id",
          locationName: "$location.name",
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
      { $group: { _id: "$departmentId", count: { $sum: 1 } } },
      {
        $lookup: {
          from: "departments",
          localField: "_id",
          foreignField: "_id",
          as: "department",
        },
      },
      { $unwind: "$department" },
      {
        $project: {
          departmentId: "$_id",
          departmentName: "$department.name",
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
      { $group: { _id: "$systemId", count: { $sum: 1 } } },
      {
        $lookup: {
          from: "systems",
          localField: "_id",
          foreignField: "_id",
          as: "system",
        },
      },
      { $unwind: "$system" },
      {
        $project: {
          systemId: "$_id",
          systemName: "$system.name",
          count: 1,
        },
      },
      { $sort: { count: -1 } },
    ]);
  }

  async getTopFailingMachines(
    filter: StatisticsFilterDto,
    limit: number = 10
  ): Promise<TopFailingMachine[]> {
    const matchStage = await this.buildMatchStage(filter);
    const stats = await this.requestModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$machineId",
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
      { $unwind: "$machine" },
      {
        $lookup: {
          from: "systems",
          localField: "machine.systemId",
          foreignField: "_id",
          as: "system",
        },
      },
      { $unwind: "$system" },
      {
        $project: {
          machineId: "$_id",
          machineName: "$machine.name",
          systemName: "$system.name",
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
    const matchStage: Record<string, any> = {};

    if (filter.fromDate || filter.toDate) {
      matchStage.createdAt = {};
      if (filter.fromDate) {
        matchStage.createdAt.$gte = new Date(filter.fromDate);
      }
      if (filter.toDate) {
        matchStage.createdAt.$lte = new Date(filter.toDate);
      }
    }

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
    userRole?: string,
    userId?: string
  ): Promise<Record<string, any>> {
    const matchStage: Record<string, any> = {};

    // Engineers can only see their own statistics
    if (userRole === Role.ENGINEER && userId) {
      // Support both String and ObjectId formats
      matchStage.engineerId = { 
        $in: [
          userId,
          Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : null
        ].filter(Boolean)
      } as any;
    }

    // Consultants can only see statistics from their departments
    if (userRole === Role.CONSULTANT && userId) {
      const consultant = (await this.userModel
        .findById(userId)
        .select("departmentIds +departmentId")
        .lean()) as { departmentIds?: unknown[]; departmentId?: unknown } | null;
      const deptIds = Array.isArray(consultant?.departmentIds)
        ? consultant.departmentIds
        : consultant?.departmentId
          ? [consultant.departmentId]
          : [];
      if (deptIds.length > 0) {
        const inValues: (Types.ObjectId | string)[] = [];
        for (const id of deptIds) {
          if (!id) continue;
          const str = String(id);
          if (Types.ObjectId.isValid(str)) {
            inValues.push(str);
            inValues.push(new Types.ObjectId(str));
          }
        }
        if (inValues.length > 0) {
          matchStage.departmentId = { $in: inValues };
        }
      }
    }

    if (filter.engineerId) {
      // Support both String and ObjectId formats
      matchStage.engineerId = { 
        $in: [
          filter.engineerId,
          Types.ObjectId.isValid(filter.engineerId) ? new Types.ObjectId(filter.engineerId) : null
        ].filter(Boolean)
      } as any;
    }

    if (filter.locationId) {
      // Support both String and ObjectId formats
      matchStage.locationId = { 
        $in: [
          filter.locationId,
          Types.ObjectId.isValid(filter.locationId) ? new Types.ObjectId(filter.locationId) : null
        ].filter(Boolean)
      } as any;
    }

    if (filter.departmentId) {
      // Support both String and ObjectId formats
      matchStage.departmentId = { 
        $in: [
          filter.departmentId,
          Types.ObjectId.isValid(filter.departmentId) ? new Types.ObjectId(filter.departmentId) : null
        ].filter(Boolean)
      } as any;
    }

    if (filter.systemId) {
      // Support both String and ObjectId formats
      matchStage.systemId = { 
        $in: [
          filter.systemId,
          Types.ObjectId.isValid(filter.systemId) ? new Types.ObjectId(filter.systemId) : null
        ].filter(Boolean)
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
}
