import { Types } from "mongoose";
import { Role } from "../enums";
import { ForbiddenAccessException } from "../exceptions";
import {
  assertDepartmentAccess,
  getDepartmentMatchValues,
  getScopeCacheKey,
  normalizeDepartmentIds,
  stableSerialize,
} from "./access-scope.util";

describe("access scope utilities", () => {
  const departmentA = "64b000000000000000000001";
  const departmentB = "64b000000000000000000002";

  it("normalizes, de-duplicates, and sorts department ids", () => {
    expect(
      normalizeDepartmentIds([
        new Types.ObjectId(departmentB),
        departmentA,
        "",
        departmentB,
      ]),
    ).toEqual([departmentA, departmentB]);
  });

  it("keeps an empty consultant scope non-matching", () => {
    const user = {
      userId: "consultant",
      role: Role.CONSULTANT,
      departmentIds: [],
    };
    expect(getDepartmentMatchValues(user)).toEqual([]);
    expect(() => assertDepartmentAccess(user, departmentA)).toThrow(
      ForbiddenAccessException,
    );
  });

  it("builds deterministic scope and filter fingerprints", () => {
    const first = {
      userId: "one",
      role: Role.CONSULTANT,
      departmentIds: [departmentB, departmentA],
    };
    const second = {
      userId: "two",
      role: Role.CONSULTANT,
      departmentIds: [departmentA, departmentB],
    };
    expect(getScopeCacheKey(first)).toBe(getScopeCacheKey(second));
    expect(stableSerialize({ b: 2, a: 1 })).toBe(
      stableSerialize({ a: 1, b: 2 }),
    );
  });
});
