import { Injectable, Inject } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { Model, Types } from "mongoose";
import { Machine, MachineDocument } from "./schemas/machine.schema";
import { CreateMachineDto, UpdateMachineDto } from "./dto";
import {
  EntityNotFoundException,
  DuplicateEntityException,
} from "../../common/exceptions";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { AuditAction } from "../../common/enums";

const CACHE_KEY = "machines:all";
const CACHE_TTL = 300000; // 5 minutes

@Injectable()
export class MachinesService {
  constructor(
    @InjectModel(Machine.name) private machineModel: Model<MachineDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private auditLogsService: AuditLogsService,
  ) {}

  async create(createMachineDto: CreateMachineDto): Promise<MachineDocument> {
    // Check for duplicate name within the same system
    const existing = await this.machineModel.findOne({
      name: { $regex: new RegExp(`^${createMachineDto.name}$`, "i") },
      systemId: createMachineDto.systemId,
    });

    if (existing) {
      throw new DuplicateEntityException(
        "Machine",
        "name",
        `${createMachineDto.name} in this system`
      );
    }

    const machine = new this.machineModel(createMachineDto);
    const saved = await machine.save();

    // Invalidate cache
    await this.invalidateCache(createMachineDto.systemId);

    return saved.populate("systemId", "name");
  }

  async findAll(activeOnly: boolean = true): Promise<MachineDocument[]> {
    const cacheKey = activeOnly ? CACHE_KEY : `${CACHE_KEY}:all`;

    const cached = await this.cacheManager.get<MachineDocument[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const filter: any = { deletedAt: null };
    if (activeOnly) {
      filter.isActive = true;
    }
    const machines = await this.machineModel
      .find(filter)
      .populate("systemId", "name")
      .sort({ createdAt: -1 });

    await this.cacheManager.set(cacheKey, machines, CACHE_TTL);

    return machines;
  }

  async findBySystem(
    systemId: string,
    activeOnly: boolean = true
  ): Promise<MachineDocument[]> {
    // Build filter to match both ObjectId and string systemId
    const filter: Record<string, unknown> = {
      $or: [
        { systemId: systemId }, // Match string
        {
          systemId: Types.ObjectId.isValid(systemId)
            ? new Types.ObjectId(systemId)
            : null,
        }, // Match ObjectId
      ],
      deletedAt: null,
    };

    if (activeOnly) {
      filter.isActive = true;
    }

    const machines = await this.machineModel
      .find(filter)
      .populate("systemId", "name")
      .sort({ createdAt: -1 });

    return machines;
  }

  async findOne(id: string): Promise<MachineDocument> {
    const machine = await this.machineModel
      .findById(id)
      .populate("systemId", "name");

    if (!machine) {
      throw new EntityNotFoundException("Machine", id);
    }

    return machine;
  }

  async update(
    id: string,
    updateMachineDto: UpdateMachineDto
  ): Promise<MachineDocument> {
    const machine = await this.machineModel.findById(id);

    if (!machine) {
      throw new EntityNotFoundException("Machine", id);
    }

    // Check for duplicate name within the same system
    if (updateMachineDto.name || updateMachineDto.systemId) {
      const systemId = updateMachineDto.systemId || machine.systemId.toString();
      const name = updateMachineDto.name || machine.name;

      const existing = await this.machineModel.findOne({
        name: { $regex: new RegExp(`^${name}$`, "i") },
        systemId,
        _id: { $ne: id },
      });

      if (existing) {
        throw new DuplicateEntityException(
          "Machine",
          "name",
          `${name} in this system`
        );
      }
    }

    const updated = await this.machineModel
      .findByIdAndUpdate(id, updateMachineDto, { new: true })
      .populate("systemId", "name");

    // Invalidate cache
    await this.invalidateCache(machine.systemId.toString());
    if (updateMachineDto.systemId) {
      await this.invalidateCache(updateMachineDto.systemId);
    }

    return updated!;
  }

  async softDelete(id: string, user: { userId: string; name: string }): Promise<void> {
    const machine = await this.machineModel.findById(id);
    if (!machine || machine.deletedAt) {
      throw new EntityNotFoundException("Machine", id);
    }

    await this.machineModel.findByIdAndUpdate(id, {
      deletedAt: new Date(),
      deletedBy: user.userId,
    });

    await this.invalidateCache(machine.systemId.toString());

    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.SOFT_DELETE,
      entity: 'Machine',
      entityId: id,
      changes: { name: machine.name },
    });
  }

  async hardDelete(id: string, user: { userId: string; name: string }): Promise<void> {
    const machine = await this.machineModel.findById(id);
    if (!machine) {
      throw new EntityNotFoundException("Machine", id);
    }

    const systemId = machine.systemId.toString();

    await this.machineModel.findByIdAndDelete(id);

    await this.invalidateCache(systemId);

    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.HARD_DELETE,
      entity: 'Machine',
      entityId: id,
      changes: { name: machine.name },
    });
  }

  async restore(id: string, user: { userId: string; name: string }): Promise<MachineDocument> {
    const machine = await this.machineModel.findById(id);
    if (!machine || !machine.deletedAt) {
      throw new EntityNotFoundException("Machine", id);
    }

    const restored = await this.machineModel.findByIdAndUpdate(
      id,
      { $unset: { deletedAt: 1, deletedBy: 1 } },
      { new: true }
    ).populate("systemId", "name");

    if (!restored) {
      throw new EntityNotFoundException("Machine", id);
    }

    await this.invalidateCache(restored.systemId.toString());

    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.RESTORE,
      entity: 'Machine',
      entityId: id,
      changes: { name: restored.name },
    });

    return restored;
  }

  async findDeleted(): Promise<MachineDocument[]> {
    const machines = await this.machineModel
      .find({ deletedAt: { $ne: null } })
      .populate("systemId", "name")
      .populate("deletedBy", "name email")
      .sort({ deletedAt: -1 });
    return machines;
  }

  // Keep for backward compatibility
  async remove(id: string): Promise<void> {
    throw new Error('Use softDelete or hardDelete instead');
  }

  private async invalidateCache(systemId: string): Promise<void> {
    await this.cacheManager.del(CACHE_KEY);
    await this.cacheManager.del(`${CACHE_KEY}:all`);
    await this.cacheManager.del(`machines:system:${systemId}:true`);
    await this.cacheManager.del(`machines:system:${systemId}:false`);
  }
}
