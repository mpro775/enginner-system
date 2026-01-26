import { Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Model, Types } from 'mongoose';
import { System, SystemDocument } from './schemas/system.schema';
import { CreateSystemDto, UpdateSystemDto } from './dto';
import {
  EntityNotFoundException,
  DuplicateEntityException,
} from '../../common/exceptions';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction } from '../../common/enums';

const CACHE_KEY = 'systems:all';
const CACHE_TTL = 300000; // 5 minutes

@Injectable()
export class SystemsService {
  constructor(
    @InjectModel(System.name) private systemModel: Model<SystemDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private auditLogsService: AuditLogsService,
  ) {}

  async create(createSystemDto: CreateSystemDto): Promise<SystemDocument> {
    const existing = await this.systemModel.findOne({
      name: { $regex: new RegExp(`^${createSystemDto.name}$`, 'i') },
    });

    if (existing) {
      throw new DuplicateEntityException('System', 'name', createSystemDto.name);
    }

    const system = new this.systemModel(createSystemDto);
    const saved = await system.save();

    // Invalidate cache for both activeOnly and all
    await this.cacheManager.del(CACHE_KEY);
    await this.cacheManager.del(`${CACHE_KEY}:all`);

    return saved.populate('departmentId', 'name');
  }

  async findAll(activeOnly: boolean = true): Promise<SystemDocument[]> {
    const cacheKey = activeOnly ? CACHE_KEY : `${CACHE_KEY}:all`;

    const cached = await this.cacheManager.get<SystemDocument[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const filter: any = { deletedAt: null };
    if (activeOnly) {
      filter.isActive = true;
    }
    const systems = await this.systemModel
      .find(filter)
      .populate('departmentId', 'name')
      .sort({ createdAt: -1 });

    await this.cacheManager.set(cacheKey, systems, CACHE_TTL);

    return systems;
  }

  async findOne(id: string): Promise<SystemDocument> {
    const system = await this.systemModel
      .findById(id)
      .populate('departmentId', 'name');

    if (!system) {
      throw new EntityNotFoundException('System', id);
    }

    return system;
  }

  async update(id: string, updateSystemDto: UpdateSystemDto): Promise<SystemDocument> {
    const system = await this.systemModel.findById(id);

    if (!system) {
      throw new EntityNotFoundException('System', id);
    }

    if (updateSystemDto.name && updateSystemDto.name !== system.name) {
      const existing = await this.systemModel.findOne({
        name: { $regex: new RegExp(`^${updateSystemDto.name}$`, 'i') },
        _id: { $ne: id },
      });

      if (existing) {
        throw new DuplicateEntityException('System', 'name', updateSystemDto.name);
      }
    }

    const updated = await this.systemModel.findByIdAndUpdate(
      id,
      updateSystemDto,
      { new: true },
    ).populate('departmentId', 'name');

    await this.cacheManager.del(CACHE_KEY);
    await this.cacheManager.del(`${CACHE_KEY}:all`);

    return updated!;
  }

  async softDelete(id: string, user: { userId: string; name: string }): Promise<void> {
    const system = await this.systemModel.findById(id);
    if (!system || system.deletedAt) {
      throw new EntityNotFoundException('System', id);
    }

    await this.systemModel.findByIdAndUpdate(id, {
      deletedAt: new Date(),
      deletedBy: user.userId,
    });

    await this.cacheManager.del(CACHE_KEY);
    await this.cacheManager.del(`${CACHE_KEY}:all`);

    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.SOFT_DELETE,
      entity: 'System',
      entityId: id,
      changes: { name: system.name },
    });
  }

  async hardDelete(id: string, user: { userId: string; name: string }): Promise<void> {
    const system = await this.systemModel.findById(id);
    if (!system) {
      throw new EntityNotFoundException('System', id);
    }

    await this.systemModel.findByIdAndDelete(id);

    await this.cacheManager.del(CACHE_KEY);
    await this.cacheManager.del(`${CACHE_KEY}:all`);

    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.HARD_DELETE,
      entity: 'System',
      entityId: id,
      changes: { name: system.name },
    });
  }

  async restore(id: string, user: { userId: string; name: string }): Promise<SystemDocument> {
    const system = await this.systemModel.findById(id);
    if (!system || !system.deletedAt) {
      throw new EntityNotFoundException('System', id);
    }

    const restored = await this.systemModel.findByIdAndUpdate(
      id,
      { $unset: { deletedAt: 1, deletedBy: 1 } },
      { new: true }
    ).populate('departmentId', 'name');

    if (!restored) {
      throw new EntityNotFoundException('System', id);
    }

    await this.cacheManager.del(CACHE_KEY);
    await this.cacheManager.del(`${CACHE_KEY}:all`);

    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.RESTORE,
      entity: 'System',
      entityId: id,
      changes: { name: restored.name },
    });

    return restored;
  }

  async findDeleted(): Promise<SystemDocument[]> {
    const systems = await this.systemModel
      .find({ deletedAt: { $ne: null } })
      .populate('deletedBy', 'name email')
      .sort({ deletedAt: -1 });
    return systems;
  }

  async findByDepartment(departmentId: string): Promise<SystemDocument[]> {
    const filter: any = {
      deletedAt: null,
      $or: [
        { departmentId: new Types.ObjectId(departmentId) },
        { departmentId: null },
        { departmentId: { $exists: false } },
      ],
    };

    return this.systemModel
      .find(filter)
      .populate('departmentId', 'name')
      .sort({ createdAt: -1 });
  }

  // Keep for backward compatibility
  async remove(id: string): Promise<void> {
    throw new Error('Use softDelete or hardDelete instead');
  }
}



