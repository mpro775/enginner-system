import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import {
  AnyBulkWriteOperation,
  Db,
  Document,
  MongoClient,
  ObjectId,
} from "mongodb";
import {
  getMongoUri,
  isObjectId,
  MACHINE_COLLECTION,
  REQUEST_COLLECTION,
  toCanonicalObjectId,
} from "./reference-id-integrity.shared";

const REQUEST_FIELDS = [
  "locationId",
  "departmentId",
  "systemId",
  "machineId",
] as const;
const TARGET_COLLECTIONS: Record<(typeof REQUEST_FIELDS)[number], string> = {
  locationId: "locations",
  departmentId: "departments",
  systemId: "systems",
  machineId: "machines",
};

interface BackupManifest {
  database: string;
  backupTimestamp: string;
  backupMethod: string;
  collections: string[];
  backupPath: string;
}

interface PlanSummary {
  documentsChanged: number;
  fieldsConverted: number;
  unsafeDocumentsSkipped: number;
  invalidReferences: number;
  orphanReferences: number;
  unexpectedTypes: number;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const manifestArg = args.find((arg) => arg.startsWith("--backup-manifest="));
  if (args.includes("--dry-run") && apply)
    throw new Error("Choose either --dry-run or --apply, not both");
  return {
    apply,
    manifestPath: manifestArg?.slice("--backup-manifest=".length),
  };
}

function verifyBackupManifest(path: string | undefined, database: string) {
  if (!path) throw new Error("--apply requires --backup-manifest=<path>");
  const manifestPath = resolve(path);
  if (!existsSync(manifestPath))
    throw new Error(`Backup manifest not found: ${manifestPath}`);
  const manifest = JSON.parse(
    readFileSync(manifestPath, "utf8"),
  ) as BackupManifest;
  if (manifest.database !== database)
    throw new Error("Backup database does not match target database");
  for (const collection of [REQUEST_COLLECTION, MACHINE_COLLECTION]) {
    if (!manifest.collections.includes(collection))
      throw new Error(`Backup manifest does not include ${collection}`);
  }
  if (!manifest.backupMethod.startsWith("mongodump"))
    throw new Error("A mongodump backup is required before normalization");
  if (!existsSync(manifest.backupPath))
    throw new Error("Backup path from manifest does not exist");
  if (!Number.isFinite(Date.parse(manifest.backupTimestamp)))
    throw new Error("Backup manifest timestamp is invalid");
}

async function existingIds(db: Db, collection: string, ids: ObjectId[]) {
  const result = new Set<string>();
  for (let index = 0; index < ids.length; index += 1000) {
    const rows = await db
      .collection(collection)
      .find(
        { _id: { $in: ids.slice(index, index + 1000) } },
        { projection: { _id: 1 } },
      )
      .toArray();
    for (const row of rows) result.add(String(row._id));
  }
  return result;
}

function classifyString(value: string, targets: Set<string>) {
  const objectId = toCanonicalObjectId(value);
  if (!objectId) return { kind: "invalid" as const };
  if (!targets.has(objectId.toHexString())) return { kind: "orphan" as const };
  return { kind: "safe" as const, objectId };
}

async function buildRequestPlan(db: Db) {
  const rows = await db
    .collection(REQUEST_COLLECTION)
    .find(
      { deletedAt: null },
      {
        projection: Object.fromEntries(
          REQUEST_FIELDS.map((field) => [field, 1]),
        ),
      },
    )
    .toArray();
  const targetSets = {} as Record<(typeof REQUEST_FIELDS)[number], Set<string>>;
  for (const field of REQUEST_FIELDS) {
    const candidates = new Map<string, ObjectId>();
    for (const row of rows) {
      const value = row[field];
      if (typeof value === "string") {
        const id = toCanonicalObjectId(value);
        if (id) candidates.set(id.toHexString(), id);
      }
    }
    targetSets[field] = await existingIds(db, TARGET_COLLECTIONS[field], [
      ...candidates.values(),
    ]);
  }

  const operations: AnyBulkWriteOperation<Document>[] = [];
  const summary: PlanSummary = {
    documentsChanged: 0,
    fieldsConverted: 0,
    unsafeDocumentsSkipped: 0,
    invalidReferences: 0,
    orphanReferences: 0,
    unexpectedTypes: 0,
  };
  for (const row of rows) {
    const set: Record<string, ObjectId> = {};
    const guards: Record<string, string> = {};
    let unsafe = false;
    for (const field of REQUEST_FIELDS) {
      const value = row[field];
      if (value == null || isObjectId(value)) continue;
      if (typeof value !== "string") {
        summary.unexpectedTypes += 1;
        unsafe = true;
        continue;
      }
      const classification = classifyString(value, targetSets[field]);
      if (classification.kind === "invalid") {
        summary.invalidReferences += 1;
        unsafe = true;
      } else if (classification.kind === "orphan") {
        summary.orphanReferences += 1;
        unsafe = true;
      } else {
        set[field] = classification.objectId;
        guards[field] = value;
      }
    }
    if (unsafe) {
      summary.unsafeDocumentsSkipped += 1;
      continue;
    }
    const fields = Object.keys(set);
    if (!fields.length) continue;
    operations.push({
      updateOne: {
        filter: { _id: row._id, deletedAt: null, ...guards },
        update: { $set: set },
      },
    });
    summary.documentsChanged += 1;
    summary.fieldsConverted += fields.length;
  }
  return { operations, summary };
}

async function buildMachinePlan(db: Db) {
  const rows = await db
    .collection(MACHINE_COLLECTION)
    .find({ deletedAt: null }, { projection: { systemId: 1 } })
    .toArray();
  const candidates = new Map<string, ObjectId>();
  for (const row of rows) {
    if (typeof row.systemId === "string") {
      const id = toCanonicalObjectId(row.systemId);
      if (id) candidates.set(id.toHexString(), id);
    }
  }
  const targets = await existingIds(db, "systems", [...candidates.values()]);
  const operations: AnyBulkWriteOperation<Document>[] = [];
  const summary: PlanSummary = {
    documentsChanged: 0,
    fieldsConverted: 0,
    unsafeDocumentsSkipped: 0,
    invalidReferences: 0,
    orphanReferences: 0,
    unexpectedTypes: 0,
  };
  for (const row of rows) {
    const value = row.systemId;
    if (value == null || isObjectId(value)) continue;
    if (typeof value !== "string") {
      summary.unexpectedTypes += 1;
      summary.unsafeDocumentsSkipped += 1;
      continue;
    }
    const classification = classifyString(value, targets);
    if (classification.kind !== "safe") {
      summary[
        classification.kind === "invalid"
          ? "invalidReferences"
          : "orphanReferences"
      ] += 1;
      summary.unsafeDocumentsSkipped += 1;
      continue;
    }
    operations.push({
      updateOne: {
        filter: { _id: row._id, deletedAt: null, systemId: value },
        update: { $set: { systemId: classification.objectId } },
      },
    });
    summary.documentsChanged += 1;
    summary.fieldsConverted += 1;
  }
  return { operations, summary };
}

async function executeBatches(
  db: Db,
  collection: string,
  operations: AnyBulkWriteOperation<Document>[],
) {
  let matched = 0;
  let modified = 0;
  for (let index = 0; index < operations.length; index += 500) {
    const result = await db
      .collection(collection)
      .bulkWrite(operations.slice(index, index + 500), {
        ordered: false,
      });
    matched += result.matchedCount;
    modified += result.modifiedCount;
  }
  return { matched, modified };
}

async function main() {
  const { apply, manifestPath } = parseArgs();
  const client = new MongoClient(getMongoUri());
  await client.connect();
  try {
    const db = client.db();
    if (apply) verifyBackupManifest(manifestPath, db.databaseName);
    const requestPlan = await buildRequestPlan(db);
    const machinePlan = await buildMachinePlan(db);

    console.log("REFERENCE ID NORMALIZATION");
    console.log(`Database: ${db.databaseName}`);
    console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);
    console.log("Scope: active documents only (deletedAt=null)");
    console.log("maintenanceRequests:", requestPlan.summary);
    console.log("machines:", machinePlan.summary);

    if (!apply) {
      console.log(
        "No writes performed. Pass --apply with a valid --backup-manifest to write.",
      );
      return;
    }
    const requestsResult = await executeBatches(
      db,
      REQUEST_COLLECTION,
      requestPlan.operations,
    );
    const machinesResult = await executeBatches(
      db,
      MACHINE_COLLECTION,
      machinePlan.operations,
    );
    console.log("Apply result:", {
      maintenanceRequests: requestsResult,
      machines: machinesResult,
    });
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("Reference ID normalization failed:", error);
  process.exitCode = 1;
});
