import { createConnection, Types } from "mongoose";
import { AnalyticsService } from "../src/modules/analytics/analytics.service";
import {
  AuditLog,
  AuditLogSchema,
} from "../src/modules/audit-logs/schemas/audit-log.schema";
import {
  Complaint,
  ComplaintSchema,
} from "../src/modules/complaints/schemas/complaint.schema";
import {
  Machine,
  MachineSchema,
} from "../src/modules/machines/schemas/machine.schema";
import {
  MaintenanceRequest,
  MaintenanceRequestSchema,
} from "../src/modules/maintenance-requests/schemas/maintenance-request.schema";
import {
  ScheduledTask,
  ScheduledTaskSchema,
} from "../src/modules/scheduled-tasks/schemas/scheduled-task.schema";
import { StatisticsService } from "../src/modules/statistics/statistics.service";
import {
  System,
  SystemSchema,
} from "../src/modules/systems/schemas/system.schema";
import { User, UserSchema } from "../src/modules/users/schemas/user.schema";
import { getMongoUri } from "./reference-id-integrity.shared";

function resolvedName(value: unknown) {
  return (
    typeof value === "string" && value !== "-" && value !== "مرجع غير متاح"
  );
}

async function main() {
  const connection = await createConnection(getMongoUri()).asPromise();
  try {
    const requestModel = connection.model(
      MaintenanceRequest.name,
      MaintenanceRequestSchema,
    );
    const machineModel = connection.model(Machine.name, MachineSchema);
    const userModel = connection.model(User.name, UserSchema);
    connection.model(System.name, SystemSchema);
    const taskModel = connection.model(ScheduledTask.name, ScheduledTaskSchema);
    const complaintModel = connection.model(Complaint.name, ComplaintSchema);
    const auditLogModel = connection.model(AuditLog.name, AuditLogSchema);
    const memoryCache = new Map<string, unknown>();
    const cache = {
      get: async (key: string) => memoryCache.get(key),
      set: async (key: string, value: unknown) =>
        void memoryCache.set(key, value),
    };
    const statistics = new StatisticsService(
      requestModel as never,
      userModel as never,
      cache as never,
    );
    const analytics = new AnalyticsService(
      requestModel as never,
      taskModel as never,
      complaintModel as never,
      machineModel as never,
      auditLogModel as never,
      cache as never,
      { get: () => process.env.ANALYTICS_TIMEZONE || "Asia/Riyadh" } as never,
    );

    const [
      byLocation,
      byDepartment,
      bySystem,
      topFailing,
      operations,
      overview,
    ] = await Promise.all([
      statistics.getByLocation({}),
      statistics.getByDepartment({}),
      statistics.getBySystem({}),
      statistics.getTopFailingMachines({}, 10),
      analytics.getOperationsDashboard({}),
      analytics.getOverview({ period: "daily" }),
    ]);

    const activeRequests = await requestModel.countDocuments({
      deletedAt: null,
    });
    const sumsMatch = (rows: Array<{ count: number }>) =>
      rows.reduce((sum, row) => sum + row.count, 0) === activeRequests;
    const named = (rows: Array<Record<string, unknown>>, key: string) =>
      rows.every((row) => resolvedName(row[key]));

    const endpointResults: Record<string, boolean> = {
      "by-location":
        byLocation.length > 0 &&
        sumsMatch(byLocation) &&
        named(byLocation, "locationName"),
      "by-department":
        byDepartment.length > 0 &&
        sumsMatch(byDepartment) &&
        named(byDepartment, "departmentName"),
      "by-system":
        bySystem.length > 0 &&
        sumsMatch(bySystem) &&
        named(bySystem, "systemName"),
      "top-failing-machines":
        topFailing.length > 0 &&
        topFailing.every(
          (row) =>
            resolvedName(row.machineName) && resolvedName(row.systemName),
        ),
      "operations-dashboard topRecurringFailures":
        operations.topRecurringFailures.length > 0 &&
        operations.topRecurringFailures.every(
          (row) =>
            resolvedName(row.machineName) && resolvedName(row.systemName),
        ),
      "location-system heatmap":
        overview.heatmaps.locationSystem.length > 0 &&
        overview.heatmaps.locationSystem.every(
          (row) =>
            resolvedName(row.locationName) && resolvedName(row.systemName),
        ),
      "analytics rankings": [
        overview.rankings.requestsPerLocation,
        overview.rankings.requestsPerDepartment,
        overview.rankings.requestsPerSystem,
        overview.rankings.requestsPerMachine,
      ].every(
        (rows) =>
          rows.length > 0 && rows.every((row) => resolvedName(row.name)),
      ),
    };

    for (const row of topFailing) {
      const rawCount = await requestModel.countDocuments({
        deletedAt: null,
        maintenanceType: "emergency",
        machineId: new Types.ObjectId(String(row.machineId)),
      });
      if (rawCount !== row.failureCount)
        endpointResults["top-failing-machines"] = false;
    }

    const profileMachineId =
      topFailing[0]?.machineId ||
      (
        await requestModel
          .findOne({ deletedAt: null })
          .select("machineId")
          .lean()
      )?.machineId;
    if (profileMachineId) {
      const profile = await analytics.getMachineProfile(
        String(profileMachineId),
        {
          page: 1,
          limit: 15,
        },
      );
      endpointResults["machine profile"] =
        resolvedName(profile.machine.name) &&
        resolvedName(profile.machine.system);
    } else {
      endpointResults["machine profile"] = false;
    }

    const spotCheckRows = await connection
      .db!.collection("maintenancerequests")
      .find(
        { deletedAt: null },
        {
          projection: {
            locationId: 1,
            departmentId: 1,
            systemId: 1,
            machineId: 1,
          },
          limit: 5,
        },
      )
      .toArray();
    let spotChecksPassed = 0;
    for (const request of spotCheckRows) {
      const [location, department, system, machine] = await Promise.all([
        connection
          .db!.collection("locations")
          .findOne({ _id: request.locationId }),
        connection
          .db!.collection("departments")
          .findOne({ _id: request.departmentId }),
        connection.db!.collection("systems").findOne({ _id: request.systemId }),
        connection
          .db!.collection("machines")
          .findOne({ _id: request.machineId }),
      ]);
      const machineSystem = machine
        ? await connection
            .db!.collection("systems")
            .findOne({ _id: machine.systemId })
        : null;
      if (location && department && system && machine && machineSystem)
        spotChecksPassed += 1;
    }
    endpointResults["5-request reference spot check"] =
      spotCheckRows.length === 5 && spotChecksPassed === 5;

    console.log("REFERENCE ANALYTICS VERIFICATION");
    console.log(`Database: ${connection.db?.databaseName}`);
    console.log(`Active requests: ${activeRequests}`);
    console.log(
      `Reference spot checks: ${spotChecksPassed}/${spotCheckRows.length}`,
    );
    for (const [endpoint, passed] of Object.entries(endpointResults)) {
      console.log(`${endpoint}: ${passed ? "PASS" : "FAIL"}`);
    }
    console.log("Samples:", {
      byLocation: byLocation[0],
      byDepartment: byDepartment[0],
      bySystem: bySystem[0],
      topFailingMachine: topFailing[0],
      recurringFailure: operations.topRecurringFailures[0],
      heatmap: overview.heatmaps.locationSystem[0],
    });
    if (Object.values(endpointResults).some((passed) => !passed))
      process.exitCode = 2;
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  console.error("Reference analytics verification failed:", error);
  process.exitCode = 1;
});
