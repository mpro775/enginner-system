// Script to fix scheduled tasks IDs from string to ObjectId
const { MongoClient, ObjectId } = require("mongodb");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/maintenance-system";

async function fixScheduledTasksIds() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db();
    const collection = db.collection("scheduledtasks");

    // Find all tasks with string IDs
    const tasks = await collection.find({}).toArray();
    console.log(`Found ${tasks.length} tasks`);

    let updatedCount = 0;

    for (const task of tasks) {
      const updateFields = {};
      let needsUpdate = false;

      // Check each ID field
      if (typeof task.engineerId === "string") {
        updateFields.engineerId = new ObjectId(task.engineerId);
        needsUpdate = true;
      }

      if (typeof task.locationId === "string") {
        updateFields.locationId = new ObjectId(task.locationId);
        needsUpdate = true;
      }

      if (typeof task.departmentId === "string") {
        updateFields.departmentId = new ObjectId(task.departmentId);
        needsUpdate = true;
      }

      if (typeof task.systemId === "string") {
        updateFields.systemId = new ObjectId(task.systemId);
        needsUpdate = true;
      }

      if (typeof task.machineId === "string") {
        updateFields.machineId = new ObjectId(task.machineId);
        needsUpdate = true;
      }

      if (typeof task.createdBy === "string") {
        updateFields.createdBy = new ObjectId(task.createdBy);
        needsUpdate = true;
      }

      if (
        task.completedRequestId &&
        typeof task.completedRequestId === "string"
      ) {
        updateFields.completedRequestId = new ObjectId(task.completedRequestId);
        needsUpdate = true;
      }

      if (needsUpdate) {
        await collection.updateOne({ _id: task._id }, { $set: updateFields });
        updatedCount++;
        console.log(`Updated task ${task.taskCode}`);
      }
    }

    console.log(`\n✅ Successfully updated ${updatedCount} tasks`);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.close();
    console.log("Disconnected from MongoDB");
  }
}

fixScheduledTasksIds();
