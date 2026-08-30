import { MongoClient } from "mongodb";
import { getMongoUri } from "./reference-id-integrity.shared";

const AUDIT_COLLECTION = "auditlogs";

async function main() {
  const client = new MongoClient(getMongoUri());
  await client.connect();
  try {
    const db = client.db();
    const auditLogs = db.collection(AUDIT_COLLECTION);
    const [total, maintenanceTotal, entityTypes, entities, samples] =
      await Promise.all([
        auditLogs.countDocuments({}),
        auditLogs.countDocuments({ entity: "MaintenanceRequest" }),
        auditLogs
          .aggregate([
            { $match: { entity: "MaintenanceRequest" } },
            { $group: { _id: { $type: "$entityId" }, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ])
          .toArray(),
        auditLogs
          .aggregate([
            { $group: { _id: "$entity", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ])
          .toArray(),
        auditLogs
          .find(
            { entity: "MaintenanceRequest" },
            { projection: { _id: 0, entity: 1, entityId: 1 } },
          )
          .limit(10)
          .toArray(),
      ]);

    const typeCount = (type: string) =>
      entityTypes.find((item) => item._id === type)?.count || 0;
    console.log(`Database: ${db.databaseName}`);
    console.log("Mode: READ ONLY");
    console.log(`Total audit logs: ${total}`);
    console.log(`MaintenanceRequest audit logs: ${maintenanceTotal}`);
    console.log(`ObjectId entityId: ${typeCount("objectId")}`);
    console.log(`String entityId: ${typeCount("string")}`);
    console.log("Entity variants:");
    for (const entity of entities) {
      console.log(`  ${String(entity._id)}: ${entity.count}`);
    }
    console.log("Sample MaintenanceRequest IDs:");
    for (const sample of samples) {
      console.log(
        `  ${String(sample.entityId)} (${sample.entityId?._bsontype || typeof sample.entityId})`,
      );
    }
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("Request activity audit failed:", error);
  process.exitCode = 1;
});
