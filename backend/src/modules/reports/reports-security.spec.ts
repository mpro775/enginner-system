import { Role } from "../../common/enums";
import { ForbiddenAccessException } from "../../common/exceptions";
import { CurrentUserData } from "../../common/decorators/current-user.decorator";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

describe("reports security", () => {
  const user = (userId: string, role: Role): CurrentUserData => ({
    userId,
    role,
    name: userId,
    email: `${userId}@example.com`,
    departmentIds: [],
  });

  it("allows only the job owner or an admin to access a bulk export job", async () => {
    const service = Object.create(ReportsService.prototype) as ReportsService;
    (service as any).bulkExportJobs = new Map([
      [
        "job-id",
        {
          id: "job-id",
          status: "queued",
          mode: "filtered",
          totalRequests: 0,
          processedRequests: 0,
          totalParts: 0,
          processedParts: 0,
          chunkSize: 10,
          createdAt: new Date(),
          ownerUserId: "owner",
        },
      ],
    ]);

    expect(
      service.getBulkExportJob("job-id", user("owner", Role.CONSULTANT)),
    ).toMatchObject({ id: "job-id" });
    expect(
      service.getBulkExportJob("job-id", user("admin", Role.ADMIN)),
    ).toMatchObject({ id: "job-id" });
    expect(() =>
      service.getBulkExportJob("job-id", user("other", Role.CONSULTANT)),
    ).toThrow(ForbiddenAccessException);
    await expect(
      service.downloadBulkExportJob(
        "job-id",
        {} as never,
        user("other", Role.CONSULTANT),
      ),
    ).rejects.toBeInstanceOf(ForbiddenAccessException);
  });

  it("preserves forbidden report errors instead of converting them to 500", async () => {
    const forbidden = new ForbiddenAccessException(
      "Department is outside your assigned scope",
    );
    const service = {
      getRequestsReport: jest.fn().mockRejectedValue(forbidden),
    };
    const controller = new ReportsController(service as never);
    const response = { headersSent: false };

    await expect(
      controller.getRequestsReport(
        {} as never,
        response as never,
        user("consultant", Role.CONSULTANT),
      ),
    ).rejects.toBe(forbidden);
  });
});
