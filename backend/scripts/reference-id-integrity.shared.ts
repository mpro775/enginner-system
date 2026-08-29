import { Db, ObjectId } from "mongodb";

export const REQUEST_COLLECTION = "maintenancerequests";
export const MACHINE_COLLECTION = "machines";

export const referenceMappings = [
  {
    sourceCollection: REQUEST_COLLECTION,
    sourceLabel: "maintenanceRequests",
    field: "locationId",
    targetCollection: "locations",
  },
  {
    sourceCollection: REQUEST_COLLECTION,
    sourceLabel: "maintenanceRequests",
    field: "departmentId",
    targetCollection: "departments",
  },
  {
    sourceCollection: REQUEST_COLLECTION,
    sourceLabel: "maintenanceRequests",
    field: "systemId",
    targetCollection: "systems",
  },
  {
    sourceCollection: REQUEST_COLLECTION,
    sourceLabel: "maintenanceRequests",
    field: "machineId",
    targetCollection: "machines",
  },
  {
    sourceCollection: MACHINE_COLLECTION,
    sourceLabel: "machines",
    field: "systemId",
    targetCollection: "systems",
  },
] as const;

export type ReferenceMapping = (typeof referenceMappings)[number];

export interface ScopeCounts {
  objectId: number;
  string: number;
  other: number;
  nullOrMissing: number;
  valid: number;
  invalid: number;
  orphan: number;
  invalidSamples: string[];
  orphanSamples: string[];
  otherSamples: string[];
}

export interface FieldAudit {
  label: string;
  active: ScopeCounts;
  softDeleted: ScopeCounts;
  total: ScopeCounts;
}

function emptyCounts(): ScopeCounts {
  return {
    objectId: 0,
    string: 0,
    other: 0,
    nullOrMissing: 0,
    valid: 0,
    invalid: 0,
    orphan: 0,
    invalidSamples: [],
    orphanSamples: [],
    otherSamples: [],
  };
}

export function isObjectId(value: unknown): value is ObjectId {
  return (
    value instanceof ObjectId ||
    (typeof value === "object" &&
      value !== null &&
      (value as { _bsontype?: string })._bsontype === "ObjectId")
  );
}

export function toCanonicalObjectId(value: string): ObjectId | null {
  if (!ObjectId.isValid(value)) return null;
  const objectId = new ObjectId(value);
  return objectId.toHexString() === value.toLowerCase() ? objectId : null;
}

function sample(values: string[], value: unknown) {
  if (values.length < 5) values.push(String(value));
}

function mergeCounts(left: ScopeCounts, right: ScopeCounts): ScopeCounts {
  return {
    objectId: left.objectId + right.objectId,
    string: left.string + right.string,
    other: left.other + right.other,
    nullOrMissing: left.nullOrMissing + right.nullOrMissing,
    valid: left.valid + right.valid,
    invalid: left.invalid + right.invalid,
    orphan: left.orphan + right.orphan,
    invalidSamples: [...left.invalidSamples, ...right.invalidSamples].slice(
      0,
      5,
    ),
    orphanSamples: [...left.orphanSamples, ...right.orphanSamples].slice(0, 5),
    otherSamples: [...left.otherSamples, ...right.otherSamples].slice(0, 5),
  };
}

async function findExistingTargets(
  db: Db,
  targetCollection: string,
  candidates: ObjectId[],
): Promise<Set<string>> {
  const existing = new Set<string>();
  const batchSize = 1000;
  for (let index = 0; index < candidates.length; index += batchSize) {
    const batch = candidates.slice(index, index + batchSize);
    const rows = await db
      .collection(targetCollection)
      .find({ _id: { $in: batch } }, { projection: { _id: 1 } })
      .toArray();
    for (const row of rows) existing.add(String(row._id));
  }
  return existing;
}

export async function auditField(
  db: Db,
  mapping: ReferenceMapping,
): Promise<FieldAudit> {
  const rows = await db
    .collection(mapping.sourceCollection)
    .find({}, { projection: { [mapping.field]: 1, deletedAt: 1 } })
    .toArray();

  const candidates = new Map<string, ObjectId>();
  for (const row of rows) {
    const value = row[mapping.field];
    if (typeof value !== "string") continue;
    const objectId = toCanonicalObjectId(value);
    if (objectId) candidates.set(objectId.toHexString(), objectId);
  }
  const existingTargets = await findExistingTargets(
    db,
    mapping.targetCollection,
    [...candidates.values()],
  );

  const active = emptyCounts();
  const softDeleted = emptyCounts();
  for (const row of rows) {
    const counts = row.deletedAt == null ? active : softDeleted;
    const value = row[mapping.field];
    if (value == null) {
      counts.nullOrMissing += 1;
    } else if (isObjectId(value)) {
      counts.objectId += 1;
    } else if (typeof value === "string") {
      counts.string += 1;
      const objectId = toCanonicalObjectId(value);
      if (!objectId) {
        counts.invalid += 1;
        sample(counts.invalidSamples, value);
      } else if (!existingTargets.has(objectId.toHexString())) {
        counts.orphan += 1;
        sample(counts.orphanSamples, value);
      } else {
        counts.valid += 1;
      }
    } else {
      counts.other += 1;
      sample(counts.otherSamples, `${row._id}:${typeof value}`);
    }
  }

  return {
    label: `${mapping.sourceLabel}.${mapping.field}`,
    active,
    softDeleted,
    total: mergeCounts(active, softDeleted),
  };
}

export async function runAudit(db: Db): Promise<FieldAudit[]> {
  const results: FieldAudit[] = [];
  for (const mapping of referenceMappings) {
    results.push(await auditField(db, mapping));
  }
  return results;
}

export function printAudit(results: FieldAudit[]) {
  console.log("REFERENCE ID AUDIT");
  console.log("==================");
  for (const result of results) {
    console.log(`\n${result.label}`);
    for (const [scope, counts] of [
      ["active", result.active],
      ["soft-deleted (excluded from normalization)", result.softDeleted],
      ["total", result.total],
    ] as const) {
      console.log(
        `${scope}: objectId=${counts.objectId} string=${counts.string} other=${counts.other} null/missing=${counts.nullOrMissing} valid=${counts.valid} invalid=${counts.invalid} orphan=${counts.orphan}`,
      );
    }
    if (result.total.invalidSamples.length)
      console.log(`invalid samples: ${result.total.invalidSamples.join(", ")}`);
    if (result.total.orphanSamples.length)
      console.log(`orphan samples: ${result.total.orphanSamples.join(", ")}`);
    if (result.total.otherSamples.length)
      console.log(
        `unexpected type samples: ${result.total.otherSamples.join(", ")}`,
      );
  }
}

export function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required");
  return uri;
}
