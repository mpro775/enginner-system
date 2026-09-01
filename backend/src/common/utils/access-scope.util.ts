import { Types } from "mongoose";
import { CurrentUserData } from "../decorators/current-user.decorator";
import { Role } from "../enums";
import { ForbiddenAccessException } from "../exceptions";

export type AccessScopedUser = Pick<
  CurrentUserData,
  "userId" | "role" | "departmentIds"
>;

function normalizeId(value: unknown): string | null {
  const rawValue =
    value && typeof value === "object" && "_id" in value
      ? (value as { _id?: unknown })._id
      : value;
  if (rawValue === null || rawValue === undefined) return null;
  const normalized = String(rawValue).trim();
  return normalized || null;
}

export function normalizeDepartmentIds(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(values.map(normalizeId).filter((id): id is string => Boolean(id))),
  ).sort();
}

export function getDepartmentIds(user: AccessScopedUser): string[] {
  return normalizeDepartmentIds(user.departmentIds);
}

export function getDepartmentObjectIds(user: AccessScopedUser): Types.ObjectId[] {
  return getDepartmentIds(user)
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));
}

export function getDepartmentMatchValues(
  user: AccessScopedUser,
): Array<string | Types.ObjectId> {
  return getDepartmentIds(user).flatMap((id) =>
    Types.ObjectId.isValid(id) ? [id, new Types.ObjectId(id)] : [id],
  );
}

export function hasDepartmentAccess(
  user: AccessScopedUser,
  departmentId: unknown,
): boolean {
  const normalized = normalizeId(departmentId);
  return normalized !== null && getDepartmentIds(user).includes(normalized);
}

export function assertDepartmentAccess(
  user: AccessScopedUser,
  departmentId: unknown,
  message = "Department is outside your assigned scope",
): void {
  if (!hasDepartmentAccess(user, departmentId)) {
    throw new ForbiddenAccessException(message);
  }
}

export function getScopeCacheKey(user: AccessScopedUser): string {
  if (user.role === Role.CONSULTANT) {
    return `consultant:${getDepartmentIds(user).join(",")}`;
  }
  if (user.role === Role.ENGINEER) {
    return `engineer:${user.userId}`;
  }
  return `global:${String(user.role).toLowerCase()}`;
}

export function stableSerialize(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
