import { Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Model, Types } from 'mongoose';
import { Location, LocationDocument } from './schemas/location.schema';
import { CreateLocationDto, UpdateLocationDto } from './dto';
import {
  EntityNotFoundException,
  DuplicateEntityException,
} from '../../common/exceptions';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction } from '../../common/enums';

const CACHE_KEY = 'locations:all';
const CACHE_TTL = 300000; // 5 minutes

@Injectable()
export class LocationsService {
  constructor(
    @InjectModel(Location.name) private locationModel: Model<LocationDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private auditLogsService: AuditLogsService,
  ) {}

  async create(createLocationDto: CreateLocationDto): Promise<LocationDocument> {
    const existing = await this.locationModel.findOne({
      name: { $regex: new RegExp(`^${createLocationDto.name}$`, 'i') },
    });

    if (existing) {
      throw new DuplicateEntityException('Location', 'name', createLocationDto.name);
    }

    const location = new this.locationModel(createLocationDto);
    const saved = await location.save();

    // Invalidate cache for both activeOnly and all
    await this.cacheManager.del(CACHE_KEY);
    await this.cacheManager.del(`${CACHE_KEY}:all`);

    return saved;
  }

  async findAll(activeOnly: boolean = true): Promise<LocationDocument[]> {
    const cacheKey = activeOnly ? CACHE_KEY : `${CACHE_KEY}:all`;

    // Try to get from cache
    const cached = await this.cacheManager.get<LocationDocument[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const filter: any = { deletedAt: null };
    if (activeOnly) {
      filter.isActive = true;
    }
    const locations = await this.locationModel.find(filter).sort({ createdAt: -1 });

    // Store in cache
    await this.cacheManager.set(cacheKey, locations, CACHE_TTL);

    return locations;
  }

  async findOne(id: string): Promise<LocationDocument> {
    const location = await this.locationModel.findById(id);

    if (!location) {
      throw new EntityNotFoundException('Location', id);
    }

    return location;
  }

  async update(id: string, updateLocationDto: UpdateLocationDto): Promise<LocationDocument> {
    const location = await this.locationModel.findById(id);

    if (!location) {
      throw new EntityNotFoundException('Location', id);
    }

    if (updateLocationDto.name && updateLocationDto.name !== location.name) {
      const existing = await this.locationModel.findOne({
        name: { $regex: new RegExp(`^${updateLocationDto.name}$`, 'i') },
        _id: { $ne: id },
      });

      if (existing) {
        throw new DuplicateEntityException('Location', 'name', updateLocationDto.name);
      }
    }

    const updated = await this.locationModel.findByIdAndUpdate(
      id,
      updateLocationDto,
      { new: true },
    );

    // Invalidate cache
    await this.cacheManager.del(CACHE_KEY);
    await this.cacheManager.del(`${CACHE_KEY}:all`);

    return updated!;
  }

  async softDelete(id: string, user: { userId: string; name: string }): Promise<void> {
    const location = await this.locationModel.findById(id);
    if (!location || location.deletedAt) {
      throw new EntityNotFoundException('Location', id);
    }

    await this.locationModel.findByIdAndUpdate(id, {
      deletedAt: new Date(),
      deletedBy: user.userId,
    });

    await this.cacheManager.del(CACHE_KEY);
    await this.cacheManager.del(`${CACHE_KEY}:all`);

    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.SOFT_DELETE,
      entity: 'Location',
      entityId: id,
      changes: { name: location.name },
    });
  }

  async hardDelete(id: string, user: { userId: string; name: string }): Promise<void> {
    const location = await this.locationModel.findById(id);
    if (!location) {
      throw new EntityNotFoundException('Location', id);
    }

    await this.locationModel.findByIdAndDelete(id);

    await this.cacheManager.del(CACHE_KEY);
    await this.cacheManager.del(`${CACHE_KEY}:all`);

    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.HARD_DELETE,
      entity: 'Location',
      entityId: id,
      changes: { name: location.name },
    });
  }

  async restore(id: string, user: { userId: string; name: string }): Promise<LocationDocument> {
    const location = await this.locationModel.findById(id);
    if (!location || !location.deletedAt) {
      throw new EntityNotFoundException('Location', id);
    }

    const restored = await this.locationModel.findByIdAndUpdate(
      id,
      { $unset: { deletedAt: 1, deletedBy: 1 } },
      { new: true }
    );

    if (!restored) {
      throw new EntityNotFoundException('Location', id);
    }

    await this.cacheManager.del(CACHE_KEY);
    await this.cacheManager.del(`${CACHE_KEY}:all`);

    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.RESTORE,
      entity: 'Location',
      entityId: id,
      changes: { name: restored.name },
    });

    return restored;
  }

  async findDeleted(): Promise<LocationDocument[]> {
    const locations = await this.locationModel
      .find({ deletedAt: { $ne: null } })
      .populate('deletedBy', 'name email')
      .sort({ deletedAt: -1 });
    return locations;
  }

  // Keep for backward compatibility
  async remove(id: string): Promise<void> {
    throw new Error('Use softDelete or hardDelete instead');
  }
}



