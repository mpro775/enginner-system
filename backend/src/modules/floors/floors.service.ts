import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Floor, FloorDocument } from "./schemas/floor.schema";
import { CreateFloorDto, UpdateFloorDto } from "./dto";
import {
  DuplicateEntityException,
  EntityNotFoundException,
} from "../../common/exceptions";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { AuditAction } from "../../common/enums";
import {
  Location,
  LocationDocument,
} from "../locations/schemas/location.schema";

@Injectable()
export class FloorsService {
  constructor(
    @InjectModel(Floor.name) private floorModel: Model<FloorDocument>,
    @InjectModel(Location.name) private locationModel: Model<LocationDocument>,
    private auditLogsService: AuditLogsService,
  ) {}

  private async assertActiveLocation(locationId: string): Promise<void> {
    if (
      !Types.ObjectId.isValid(locationId) ||
      !(await this.locationModel.exists({
        _id: new Types.ObjectId(locationId),
        isActive: true,
        deletedAt: null,
      }))
    ) {
      throw new EntityNotFoundException("Active Location", locationId);
    }
  }

  private async assertUniqueName(
    name: string,
    locationId: string,
    excludeId?: string,
  ): Promise<void> {
    const filter: Record<string, unknown> = {
      name: { $regex: new RegExp(`^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      locationId: new Types.ObjectId(locationId),
      deletedAt: null,
    };
    if (excludeId) filter._id = { $ne: excludeId };
    if (await this.floorModel.exists(filter)) {
      throw new DuplicateEntityException("Floor", "name", name);
    }
  }

  async create(dto: CreateFloorDto): Promise<FloorDocument> {
    await this.assertActiveLocation(dto.locationId);
    await this.assertUniqueName(dto.name, dto.locationId);
    return new this.floorModel({
      name: dto.name.trim(),
      locationId: new Types.ObjectId(dto.locationId),
    }).save();
  }

  async findAll(activeOnly = true): Promise<FloorDocument[]> {
    return this.floorModel
      .find({ deletedAt: null, ...(activeOnly ? { isActive: true } : {}) })
      .populate("locationId", "name")
      .sort({ createdAt: -1 });
  }

  async findByLocation(locationId: string): Promise<FloorDocument[]> {
    if (!Types.ObjectId.isValid(locationId)) return [];
    return this.floorModel
      .find({
        locationId: new Types.ObjectId(locationId),
        isActive: true,
        deletedAt: null,
      })
      .populate("locationId", "name")
      .sort({ name: 1 });
  }

  async findOne(id: string): Promise<FloorDocument> {
    const floor = await this.floorModel.findById(id).populate("locationId", "name");
    if (!floor) throw new EntityNotFoundException("Floor", id);
    return floor;
  }

  async update(id: string, dto: UpdateFloorDto): Promise<FloorDocument> {
    const floor = await this.floorModel.findById(id);
    if (!floor) throw new EntityNotFoundException("Floor", id);
    const locationId = dto.locationId || floor.locationId.toString();
    const name = dto.name?.trim() || floor.name;
    if (dto.locationId !== undefined) {
      await this.assertActiveLocation(dto.locationId);
    }
    if (dto.name !== undefined || dto.locationId !== undefined) {
      await this.assertUniqueName(name, locationId, id);
    }
    const updated = await this.floorModel
      .findByIdAndUpdate(
        id,
        {
          ...dto,
          ...(dto.name !== undefined ? { name } : {}),
          ...(dto.locationId
            ? { locationId: new Types.ObjectId(dto.locationId) }
            : {}),
        },
        { new: true },
      )
      .populate("locationId", "name");
    return updated!;
  }

  async softDelete(id: string, user: { userId: string; name: string }) {
    const floor = await this.floorModel.findOne({ _id: id, deletedAt: null });
    if (!floor) throw new EntityNotFoundException("Floor", id);
    await this.floorModel.findByIdAndUpdate(id, {
      deletedAt: new Date(),
      deletedBy: user.userId,
    });
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.SOFT_DELETE,
      entity: "Floor",
      entityId: id,
      changes: { name: floor.name },
    });
  }

  async hardDelete(id: string, user: { userId: string; name: string }) {
    const floor = await this.floorModel.findById(id);
    if (!floor) throw new EntityNotFoundException("Floor", id);
    await this.floorModel.findByIdAndDelete(id);
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.HARD_DELETE,
      entity: "Floor",
      entityId: id,
      changes: { name: floor.name },
    });
  }

  async restore(id: string, user: { userId: string; name: string }) {
    const floor = await this.floorModel.findOne({ _id: id, deletedAt: { $ne: null } });
    if (!floor) throw new EntityNotFoundException("Floor", id);
    await this.assertUniqueName(floor.name, floor.locationId.toString(), id);
    const restored = await this.floorModel
      .findByIdAndUpdate(id, { $unset: { deletedAt: 1, deletedBy: 1 } }, { new: true })
      .populate("locationId", "name");
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.RESTORE,
      entity: "Floor",
      entityId: id,
      changes: { name: floor.name },
    });
    return restored!;
  }

  async findDeleted(): Promise<FloorDocument[]> {
    return this.floorModel
      .find({ deletedAt: { $ne: null } })
      .populate("locationId", "name")
      .populate("deletedBy", "name email")
      .sort({ deletedAt: -1 });
  }
}
