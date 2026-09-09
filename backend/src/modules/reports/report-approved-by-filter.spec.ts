import { Types } from "mongoose";
import { Role } from "../../common/enums";
import { StatisticsService } from "../statistics/statistics.service";
import { ReportsService } from "./reports.service";

const approvedById = "64b000000000000000000003";
const admin = {
  userId: "64b000000000000000000001",
  name: "Admin",
  email: "admin@example.com",
  role: Role.ADMIN,
  departmentIds: [],
};

describe("approved consultant report filter", () => {
  it("filters report rows by completionApprovedBy", () => {
    const service = Object.create(ReportsService.prototype) as ReportsService;
    const match = (
      service as unknown as {
        buildMatchStage: (filter: { approvedById: string }) => Record<string, unknown>;
      }
    ).buildMatchStage({ approvedById });

    expect(match).toMatchObject({
      completionApprovedBy: {
        $in: [approvedById, new Types.ObjectId(approvedById)],
      },
    });
  });

  it("applies approvedById inside statistics aggregation", async () => {
    const service = Object.create(StatisticsService.prototype) as StatisticsService;
    const match = await (
      service as unknown as {
        buildMatchStage: (
          filter: { approvedById: string },
          user: typeof admin,
        ) => Promise<Record<string, unknown>>;
      }
    ).buildMatchStage({ approvedById }, admin);

    expect(match).toMatchObject({
      completionApprovedBy: {
        $in: [approvedById, new Types.ObjectId(approvedById)],
      },
    });
  });

  it("passes the approved consultant filter to every summary calculation", async () => {
    const statisticsService = {
      getDashboardStatistics: jest.fn().mockResolvedValue({}),
      getByStatus: jest.fn().mockResolvedValue({}),
      getByMaintenanceType: jest.fn().mockResolvedValue({}),
      getByLocation: jest.fn().mockResolvedValue([]),
      getByDepartment: jest.fn().mockResolvedValue([]),
      getTopFailingMachines: jest.fn().mockResolvedValue([]),
    };
    const service = Object.create(ReportsService.prototype) as ReportsService;
    (service as unknown as { statisticsService: typeof statisticsService }).statisticsService =
      statisticsService;

    await service.getSummaryReport({ approvedById }, admin);

    Object.values(statisticsService).forEach((calculation) => {
      expect(calculation.mock.calls[0][0]).toMatchObject({ approvedById });
    });
  });
});
