import { Role } from "../../common/enums";
import { ForbiddenAccessException } from "../../common/exceptions";
import { CurrentUserData } from "../../common/decorators/current-user.decorator";
import { StatisticsService } from "./statistics.service";

describe("statistics consultant scope", () => {
  const departmentA = "64b000000000000000000001";
  const departmentB = "64b000000000000000000002";

  const consultant = (departmentIds: string[]): CurrentUserData => ({
    userId: "64b000000000000000000010",
    email: "consultant@example.com",
    name: "Consultant",
    role: Role.CONSULTANT,
    departmentIds,
  });

  function createService() {
    const requestModel = { aggregate: jest.fn().mockResolvedValue([]) };
    const cacheManager = {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
    };
    return {
      service: new StatisticsService(
        requestModel as never,
        cacheManager as never,
      ),
      cacheManager,
    };
  }

  it("uses an explicit empty match for consultants without departments", async () => {
    const { service } = createService();
    const match = await (service as any).buildMatchStage({}, consultant([]));
    expect(match.departmentId).toEqual({ $in: [] });
  });

  it("rejects an explicit department outside the consultant scope", async () => {
    const { service } = createService();
    await expect(
      (service as any).buildMatchStage(
        { departmentId: departmentB },
        consultant([departmentA]),
      ),
    ).rejects.toBeInstanceOf(ForbiddenAccessException);
  });

  it("isolates cached engineer statistics by consultant scope", async () => {
    const { service, cacheManager } = createService();
    await service.getByEngineer({}, consultant([departmentA]));
    await service.getByEngineer({}, consultant([departmentB]));

    const firstKey = cacheManager.get.mock.calls[0][0];
    const secondKey = cacheManager.get.mock.calls[1][0];
    expect(firstKey).not.toBe(secondKey);
    expect(firstKey).toContain(`consultant:${departmentA}`);
    expect(secondKey).toContain(`consultant:${departmentB}`);
  });
});
