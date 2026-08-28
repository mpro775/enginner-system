import { MongoClient, ObjectId, Db } from "mongodb";

const DB_NAME = "enginner-system";
const RESTORED_EMAIL = "eng.khader.babtat@restored.local";

const RESTORE_START = new Date("2026-04-14T00:00:00.000Z");
const RESTORE_END = new Date("2026-04-15T00:00:00.000Z");

type Args = {
  apply: boolean;
  hardDelete: boolean;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);

  return {
    apply: args.includes("--apply"),
    hardDelete: args.includes("--hard-delete"),
  };
}

async function countUsage(db: Db, fieldName: string, refId: ObjectId): Promise<number> {
  const requestsCount = await db.collection("maintenancerequests").countDocuments({
    [fieldName]: refId,
    deletedAt: null,
  });

  const tasksCount = await db.collection("scheduledtasks").countDocuments({
    [fieldName]: refId,
    deletedAt: null,
  });

  return requestsCount + tasksCount;
}

async function main() {
  const { apply, hardDelete } = parseArgs();

  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is required. Please set it before running the script.");
  }

  const client = new MongoClient(mongoUri);

  await client.connect();

  try {
    const db = client.db(DB_NAME);
    const now = new Date();

    console.log("==================================================");
    console.log(" February 2026 Restore Cleanup Script");
    console.log("==================================================");
    console.log(`Database: ${DB_NAME}`);
    console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);
    console.log(`Delete mode: ${hardDelete ? "HARD DELETE" : "SOFT DELETE"}`);
    console.log("==================================================\n");

    const restoredUser = await db.collection("users").findOne({
      email: RESTORED_EMAIL,
    });

    const restoredUserId = restoredUser?._id as ObjectId | undefined;

    if (restoredUser) {
      console.log("Restored user found:");
      console.log(`- Name: ${restoredUser.name}`);
      console.log(`- Email: ${restoredUser.email}`);
      console.log(`- ID: ${restoredUserId}`);
      console.log("");
    } else {
      console.log("Restored user not found. Continuing with request/task filters.\n");
    }

    const requestFilter: Record<string, unknown> = {
      requestCode: { $regex: /^(EM|PM)-202602-/ },
      $or: [
        ...(restoredUserId ? [{ engineerId: restoredUserId }] : []),
        {
          createdAt: {
            $gte: RESTORE_START,
            $lt: RESTORE_END,
          },
        },
        {
          updatedAt: {
            $gte: RESTORE_START,
            $lt: RESTORE_END,
          },
        },
        {
          reasonText: {
            $regex: /بيانات مسترجعة|Recovered/i,
          },
        },
      ],
    };

    const requestsToRemove = await db
      .collection("maintenancerequests")
      .find(requestFilter, {
        projection: {
          _id: 1,
          requestCode: 1,
          maintenanceType: 1,
          status: 1,
          engineerId: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      })
      .toArray();

    console.log(`Maintenance requests to remove: ${requestsToRemove.length}`);

    for (const request of requestsToRemove.slice(0, 30)) {
      console.log(`- ${request.requestCode}`);
    }

    if (requestsToRemove.length > 30) {
      console.log(`... and ${requestsToRemove.length - 30} more`);
    }

    console.log("");

    const taskFilter: Record<string, unknown> = {
      $or: [
        {
          taskCode: {
            $regex: /^TASK-202602-/,
          },
        },
        {
          scheduledMonth: 2,
          scheduledYear: 2026,
          title: "بيانات مسترجعة من تقرير الوقائية المجمع لشهر فبراير",
        },
        ...(restoredUserId ? [{ engineerId: restoredUserId }] : []),
      ],
    };

    const tasksToRemove = await db
      .collection("scheduledtasks")
      .find(taskFilter, {
        projection: {
          _id: 1,
          taskCode: 1,
          title: 1,
          engineerId: 1,
          scheduledMonth: 1,
          scheduledYear: 1,
        },
      })
      .toArray();

    console.log(`Scheduled tasks to remove: ${tasksToRemove.length}`);

    for (const task of tasksToRemove.slice(0, 30)) {
      console.log(`- ${task.taskCode ?? task.title}`);
    }

    if (tasksToRemove.length > 30) {
      console.log(`... and ${tasksToRemove.length - 30} more`);
    }

    console.log("");

    const recoveredMachineFilter = {
      description: "Recovered from February 2026 reports",
    };

    const recoveredSystemFilter = {
      $or: [
        {
          description: "Recovered from February 2026 reports",
        },
        {
          name: {
            $in: ["التكييف", "الحريق", "والسالمة المن"],
          },
        },
      ],
    };

    const recoveredMachines = await db
      .collection("machines")
      .find(recoveredMachineFilter, {
        projection: {
          _id: 1,
          name: 1,
          description: 1,
        },
      })
      .toArray();

    const recoveredSystems = await db
      .collection("systems")
      .find(recoveredSystemFilter, {
        projection: {
          _id: 1,
          name: 1,
          description: 1,
        },
      })
      .toArray();

    const removableMachines: typeof recoveredMachines = [];
    const keptMachines: Array<{ item: any; usage: number }> = [];

    for (const machine of recoveredMachines) {
      const usage = await countUsage(db, "machineId", machine._id as ObjectId);

      if (usage === 0) {
        removableMachines.push(machine);
      } else {
        keptMachines.push({ item: machine, usage });
      }
    }

    const removableSystems: typeof recoveredSystems = [];
    const keptSystems: Array<{ item: any; usage: number }> = [];

    for (const system of recoveredSystems) {
      const usage = await countUsage(db, "systemId", system._id as ObjectId);

      if (usage === 0) {
        removableSystems.push(system);
      } else {
        keptSystems.push({ item: system, usage });
      }
    }

    console.log(`Recovered machines candidates: ${recoveredMachines.length}`);
    console.log(`Recovered machines removable now: ${removableMachines.length}`);
    console.log(`Recovered machines kept because still used: ${keptMachines.length}`);
    console.log("");

    console.log(`Recovered systems candidates: ${recoveredSystems.length}`);
    console.log(`Recovered systems removable now: ${removableSystems.length}`);
    console.log(`Recovered systems kept because still used: ${keptSystems.length}`);
    console.log("");

    if (!apply) {
      console.log("==================================================");
      console.log("DRY RUN ONLY. No changes were applied.");
      console.log("Review the numbers above.");
      console.log("Then run with --apply if everything is correct.");
      console.log("==================================================");
      return;
    }

    console.log("Applying cleanup...\n");

    const requestIds = requestsToRemove.map((request) => request._id);
    const taskIds = tasksToRemove.map((task) => task._id);

    if (hardDelete) {
      const requestDeleteResult = await db.collection("maintenancerequests").deleteMany({
        _id: {
          $in: requestIds,
        },
      });

      const taskDeleteResult = await db.collection("scheduledtasks").deleteMany({
        _id: {
          $in: taskIds,
        },
      });

      console.log(`Hard deleted maintenance requests: ${requestDeleteResult.deletedCount}`);
      console.log(`Hard deleted scheduled tasks: ${taskDeleteResult.deletedCount}`);
    } else {
      const requestSoftDeleteResult = await db.collection("maintenancerequests").updateMany(
        {
          _id: {
            $in: requestIds,
          },
        },
        {
          $set: {
            deletedAt: now,
            deletedBy: "restore-cleanup-script",
            deleteReason: "Removed February 2026 restored maintenance requests after management decision",
          },
        }
      );

      const taskSoftDeleteResult = await db.collection("scheduledtasks").updateMany(
        {
          _id: {
            $in: taskIds,
          },
        },
        {
          $set: {
            deletedAt: now,
            deletedBy: "restore-cleanup-script",
            deleteReason: "Removed February 2026 restored scheduled tasks after management decision",
          },
        }
      );

      console.log(`Soft deleted maintenance requests: ${requestSoftDeleteResult.modifiedCount}`);
      console.log(`Soft deleted scheduled tasks: ${taskSoftDeleteResult.modifiedCount}`);
    }

    console.log("");

    if (restoredUserId) {
      const remainingRestoredUserUsage =
        (await db.collection("maintenancerequests").countDocuments({
          engineerId: restoredUserId,
          deletedAt: null,
        })) +
        (await db.collection("scheduledtasks").countDocuments({
          engineerId: restoredUserId,
          deletedAt: null,
        }));

      if (remainingRestoredUserUsage === 0) {
        await db.collection("users").updateOne(
          {
            _id: restoredUserId,
          },
          {
            $set: {
              isActive: false,
              deletedAt: now,
              deleteReason: "Disabled after February 2026 restore rollback",
            },
          }
        );

        console.log("Restored user disabled successfully.");
      } else {
        console.log(
          `Restored user was NOT disabled because still used by ${remainingRestoredUserUsage} active documents.`
        );
      }
    }

    console.log("");

    let cleanedMachines = 0;

    for (const machine of recoveredMachines) {
      const usage = await countUsage(db, "machineId", machine._id as ObjectId);

      if (usage === 0) {
        if (hardDelete) {
          await db.collection("machines").deleteOne({
            _id: machine._id,
          });
        } else {
          await db.collection("machines").updateOne(
            {
              _id: machine._id,
            },
            {
              $set: {
                isActive: false,
                deletedAt: now,
                deleteReason: "Disabled unused recovered machine after February 2026 restore rollback",
              },
            }
          );
        }

        cleanedMachines++;
      }
    }

    let cleanedSystems = 0;

    for (const system of recoveredSystems) {
      const usage = await countUsage(db, "systemId", system._id as ObjectId);

      if (usage === 0) {
        if (hardDelete) {
          await db.collection("systems").deleteOne({
            _id: system._id,
          });
        } else {
          await db.collection("systems").updateOne(
            {
              _id: system._id,
            },
            {
              $set: {
                isActive: false,
                deletedAt: now,
                deleteReason: "Disabled unused recovered system after February 2026 restore rollback",
              },
            }
          );
        }

        cleanedSystems++;
      }
    }

    console.log(`Cleaned recovered machines: ${cleanedMachines}`);
    console.log(`Cleaned recovered systems: ${cleanedSystems}`);
    console.log("");

    const remainingActiveFebRequests = await db.collection("maintenancerequests").countDocuments({
      requestCode: {
        $regex: /^(EM|PM)-202602-/,
      },
      deletedAt: null,
    });

    const remainingActiveFebTasks = await db.collection("scheduledtasks").countDocuments({
      taskCode: {
        $regex: /^TASK-202602-/,
      },
      deletedAt: null,
    });

    const restoredUserAfterCleanup = await db.collection("users").findOne({
      email: RESTORED_EMAIL,
    });

    console.log("==================================================");
    console.log("Final Checks");
    console.log("==================================================");
    console.log(`Remaining active February restored requests: ${remainingActiveFebRequests}`);
    console.log(`Remaining active February restored tasks: ${remainingActiveFebTasks}`);

    if (restoredUserAfterCleanup) {
      console.log(`Restored user active: ${restoredUserAfterCleanup.isActive}`);
      console.log(`Restored user deletedAt: ${restoredUserAfterCleanup.deletedAt ?? "null"}`);
    } else {
      console.log("Restored user no longer exists.");
    }

    console.log("==================================================");
    console.log("Done.");
    console.log("==================================================");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("Cleanup script failed:");
  console.error(error);
  process.exit(1);
});