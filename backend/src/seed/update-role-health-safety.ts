import { NestFactory } from "@nestjs/core";
import { Model } from "mongoose";
import { AppModule } from "../app.module";
import { getModelToken } from "@nestjs/mongoose";
import { User } from "../modules/users/schemas/user.schema";
import { MaintenanceRequest } from "../modules/maintenance-requests/schemas/maintenance-request.schema";

async function updateRole() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const userModel = app.get<Model<User>>(getModelToken(User.name));
  const requestModel = app.get<Model<MaintenanceRequest>>(
    getModelToken(MaintenanceRequest.name)
  );

  console.log("🔄 Starting role update migration...");
  console.log("─".repeat(50));

  try {
    // Update users collection
    const userUpdateResult = await userModel.updateMany(
      { role: "health_safety_supervisor" },
      { $set: { role: "maintenance_safety_monitor" } }
    );

    console.log(
      `✓ Updated ${userUpdateResult.modifiedCount} user(s) in users collection`
    );

    // Check if there are any remaining users with old role
    const remainingUsers = await userModel.countDocuments({
      role: "health_safety_supervisor",
    });

    if (remainingUsers > 0) {
      console.warn(
        `⚠️  Warning: ${remainingUsers} user(s) still have the old role`
      );
    } else {
      console.log("✓ All users have been updated successfully");
    }

    // Note: MaintenanceRequest schema uses healthSafetySupervisorId as ObjectId reference
    // The role change in users collection is sufficient as the reference is by ID, not role
    // But we can verify if any requests reference users with old role
    const usersWithOldRole = await userModel.find({
      role: "health_safety_supervisor",
    });

    if (usersWithOldRole.length > 0) {
      const userIds = usersWithOldRole.map((u) => u._id);
      const requestsWithOldRoleUsers = await requestModel.countDocuments({
        healthSafetySupervisorId: { $in: userIds },
      });

      if (requestsWithOldRoleUsers > 0) {
        console.log(
          `ℹ️  Found ${requestsWithOldRoleUsers} maintenance request(s) referencing users with old role`
        );
        console.log(
          "   These will be automatically updated when the referenced users are updated"
        );
      }
    }

    console.log("\n✅ Migration completed successfully!");
    console.log("─".repeat(50));
    console.log("\n📊 Summary:");
    console.log(`   - Users updated: ${userUpdateResult.modifiedCount}`);
    console.log(`   - Users remaining with old role: ${remainingUsers}`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await app.close();
  }
}

updateRole().catch((error) => {
  console.error("❌ Script execution failed:", error);
  process.exit(1);
});
