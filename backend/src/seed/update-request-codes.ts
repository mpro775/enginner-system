import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { getModelToken } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AppModule } from "../app.module";
import {
  MaintenanceRequest,
  MaintenanceRequestDocument,
} from "../modules/maintenance-requests/schemas/maintenance-request.schema";
import { MaintenanceType } from "../common/enums";

type LeanRequest = {
  _id: string;
  requestCode?: string;
  maintenanceType?: MaintenanceType;
  createdAt?: Date;
};

function buildRequestCode(request: LeanRequest): string {
  const rawCode = request.requestCode || "";
  const parts = rawCode.split("-");
  const datePart =
    parts[1] ||
    (() => {
      const d =
        request.createdAt instanceof Date
          ? request.createdAt
          : new Date(request.createdAt ?? Date.now());
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      return `${year}${month}`;
    })();
  const sequencePart = parts[2]
    ? String(parts[2]).padStart(4, "0")
    : "0001";

  const prefix =
    request.maintenanceType === MaintenanceType.PREVENTIVE
      ? "PM"
      : request.maintenanceType === MaintenanceType.EMERGENCY
      ? "EM"
      : "MR";

  return `${prefix}-${datePart}-${sequencePart}`;
}

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const requestModel = app.get<Model<MaintenanceRequestDocument>>(
    getModelToken(MaintenanceRequest.name)
  );

  try {
    const requests = (await requestModel
      .find({}, { requestCode: 1, maintenanceType: 1, createdAt: 1 })
      .lean()) as unknown as LeanRequest[];

    const ops = requests
      .map((req) => {
        const newCode = buildRequestCode(req);
        if (newCode === req.requestCode) {
          return null;
        }
        return {
          updateOne: {
            filter: { _id: req._id },
            update: { $set: { requestCode: newCode } },
          },
        };
      })
      .filter(Boolean) as Parameters<Model<MaintenanceRequestDocument>["bulkWrite"]>[0];

    if (!ops.length) {
      console.log("No request codes needed updating.");
      await app.close();
      return;
    }

    const result = await requestModel.bulkWrite(ops);
    console.log(
      `Updated ${result.modifiedCount ?? 0} maintenance request codes.`
    );
  } catch (error) {
    console.error("❌ Failed to update request codes:", error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

run();

