/**
 * Migration script: departmentId -> departmentIds
 *
 * Converts:
 * - systems: departmentId (single) -> departmentIds (array)
 * - users: departmentId (single) -> departmentIds (array)
 *
 * Run with: node scripts/migrate-department-to-department-ids.js
 * Ensure MONGODB_URI is set in .env or as environment variable
 */
require("dotenv").config();
const { MongoClient, ObjectId } = require("mongodb");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/maintenance-system";

async function migrate() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log("Connected to MongoDB\n");

    const db = client.db();

    // 1. Migrate systems collection
    const systemsCollection = db.collection("systems");
    const systemsWithDept = await systemsCollection
      .find({ departmentId: { $exists: true, $ne: null } })
      .toArray();

    let systemsUpdated = 0;
    for (const doc of systemsWithDept) {
      const deptId = doc.departmentId;
      const deptObjId =
        typeof deptId === "string" && ObjectId.isValid(deptId)
          ? new ObjectId(deptId)
          : deptId;
      if (deptObjId) {
        await systemsCollection.updateOne(
          { _id: doc._id },
          {
            $set: { departmentIds: [deptObjId] },
            $unset: { departmentId: "" },
          }
        );
        systemsUpdated++;
        console.log(`  System "${doc.name}": departmentId -> departmentIds`);
      }
    }
    console.log(`\n✓ Systems: migrated ${systemsUpdated} documents\n`);

    // 2. Migrate users collection
    const usersCollection = db.collection("users");
    const usersWithDept = await usersCollection
      .find({ departmentId: { $exists: true, $ne: null } })
      .toArray();

    let usersUpdated = 0;
    for (const doc of usersWithDept) {
      const deptId = doc.departmentId;
      const deptObjId =
        typeof deptId === "string" && ObjectId.isValid(deptId)
          ? new ObjectId(deptId)
          : deptId;
      if (deptObjId) {
        await usersCollection.updateOne(
          { _id: doc._id },
          {
            $set: { departmentIds: [deptObjId] },
            $unset: { departmentId: "" },
          }
        );
        usersUpdated++;
        console.log(
          `  User "${doc.name}" (${doc.email}): departmentId -> departmentIds`
        );
      }
    }
    console.log(`\n✓ Users: migrated ${usersUpdated} documents\n`);

    console.log("✅ Migration completed successfully");
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  } finally {
    await client.close();
    console.log("Disconnected from MongoDB");
  }
}

migrate();
