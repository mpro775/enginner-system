/**
 * Migration script: تحديث منشئ المهام الوقائية من مدير النظام إلى الاستشاري قاسم
 *
 * يعدّل جميع المهام المجدولة (ScheduledTask) التي أنشأها مدير النظام
 * بحيث يصبح منشئها الاستشاري قاسم.
 *
 * Run with: node scripts/update-preventive-requests-creator.js
 * Ensure MONGODB_URI is set in .env or as environment variable
 */
require("dotenv").config();
const { MongoClient, ObjectId } = require("mongodb");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/maintenance-system";

// مدير النظام - System Admin
const ADMIN_ID = "69414abb5520ff69b186ec54";

// الاستشاري قاسم - Consultant Kassem
const CONSULTANT_KASSEM_ID = "696f18eb75895b23909fc81f";

function toObjectId(id) {
  if (!id) return null;
  if (id instanceof ObjectId) return id;
  if (typeof id === "string" && ObjectId.isValid(id)) return new ObjectId(id);
  return null;
}

async function updatePreventiveRequestsCreator() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log("Connected to MongoDB\n");

    const db = client.db();
    const adminObjectId = toObjectId(ADMIN_ID);
    const consultantObjectId = toObjectId(CONSULTANT_KASSEM_ID);

    if (!adminObjectId || !consultantObjectId) {
      console.error("Invalid admin or consultant ID");
      process.exit(1);
    }

    const scheduledTasksCollection = db.collection("scheduledtasks");

    // Find all tasks where createdBy = admin (handle both ObjectId and string)
    const tasksToUpdate = await scheduledTasksCollection
      .find({
        createdBy: { $in: [adminObjectId, ADMIN_ID] },
      })
      .toArray();

    console.log(
      `Found ${tasksToUpdate.length} scheduled tasks created by System Admin\n`
    );

    if (tasksToUpdate.length === 0) {
      console.log("No tasks to update. Exiting.");
      return;
    }

    let updatedCount = 0;
    for (const task of tasksToUpdate) {
      const result = await scheduledTasksCollection.updateOne(
        { _id: task._id },
        { $set: { createdBy: consultantObjectId } }
      );

      if (result.modifiedCount > 0) {
        updatedCount++;
        console.log(`  ✓ Updated task: ${task.taskCode} (${task.title})`);
      }
    }

    console.log(`\n✅ Successfully updated ${updatedCount} scheduled tasks`);
    console.log("   منشئ المهمة changed from مدير النظام to الاستشاري قاسم");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  } finally {
    await client.close();
    console.log("\nDisconnected from MongoDB");
  }
}

updatePreventiveRequestsCreator();
