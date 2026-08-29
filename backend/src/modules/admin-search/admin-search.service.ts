import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  MaintenanceRequest,
  MaintenanceRequestDocument,
} from "../maintenance-requests/schemas/maintenance-request.schema";
import { Machine, MachineDocument } from "../machines/schemas/machine.schema";
import {
  Complaint,
  ComplaintDocument,
} from "../complaints/schemas/complaint.schema";
import { User, UserDocument } from "../users/schemas/user.schema";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

@Injectable()
export class AdminSearchService {
  constructor(
    @InjectModel(MaintenanceRequest.name)
    private readonly requestModel: Model<MaintenanceRequestDocument>,
    @InjectModel(Machine.name)
    private readonly machineModel: Model<MachineDocument>,
    @InjectModel(Complaint.name)
    private readonly complaintModel: Model<ComplaintDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async search(rawQuery: string, limit: number) {
    const q = rawQuery.trim();
    const regex = new RegExp(escapeRegex(q), "i");
    const [requests, machines, complaints, users] = await Promise.all([
      this.requestModel
        .find({
          deletedAt: null,
          $or: [
            { requestCode: regex },
            { reasonText: regex },
            { machineNumber: regex },
          ],
        })
        .select(
          "requestCode reasonText status maintenanceType machineId locationId",
        )
        .populate("machineId", "name")
        .populate("locationId", "name")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      this.machineModel
        .find({
          deletedAt: null,
          $or: [{ name: regex }, { description: regex }],
        })
        .select("name description systemId")
        .populate("systemId", "name")
        .sort({ name: 1 })
        .limit(limit)
        .lean(),
      this.complaintModel
        .find({
          deletedAt: null,
          $or: [
            { complaintCode: regex },
            { reporterNameAr: regex },
            { reporterNameEn: regex },
            { locationAr: regex },
            { locationEn: regex },
            { descriptionAr: regex },
            { descriptionEn: regex },
          ],
        })
        .select(
          "complaintCode reporterNameAr reporterNameEn locationAr locationEn status",
        )
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      this.userModel
        .find({
          deletedAt: null,
          $or: [{ name: regex }, { email: regex }],
        })
        .select("name email role isActive")
        .sort({ name: 1 })
        .limit(limit)
        .lean(),
    ]);

    return {
      query: q,
      groups: {
        requests: requests.map((item: Record<string, any>) => ({
          id: String(item._id),
          title: item.requestCode,
          subtitle: item.reasonText,
          meta: {
            status: item.status,
            maintenanceType: item.maintenanceType,
            machine: item.machineId?.name || null,
            location: item.locationId?.name || null,
          },
        })),
        machines: machines.map((item: Record<string, any>) => ({
          id: String(item._id),
          title: item.name,
          subtitle: item.description || item.systemId?.name || "",
          meta: { system: item.systemId?.name || null },
        })),
        complaints: complaints.map((item: Record<string, any>) => ({
          id: String(item._id),
          title: item.complaintCode,
          subtitle: item.reporterNameAr || item.reporterNameEn,
          meta: {
            location: item.locationAr || item.locationEn,
            status: item.status,
          },
        })),
        users: users.map((item: Record<string, any>) => ({
          id: String(item._id),
          title: item.name,
          subtitle: item.email,
          meta: { role: item.role, isActive: item.isActive },
        })),
      },
    };
  }
}
