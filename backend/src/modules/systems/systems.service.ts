import { Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Model } from 'mongoose';
import { System, SystemDocument } from './schemas/system.schema';
import { CreateSystemDto, UpdateSystemDto } from './dto';
import {
  EntityNotFoundException,
  DuplicateEntityException,
} from '../../common/exceptions';

const CACHE_KEY = 'systems:all';
const CACHE_TTL = 300000; // 5 minutes

@Injectable()
export class SystemsService {
  constructor(
    @InjectModel(System.name) private systemModel: Model<SystemDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
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

    return saved;
  }

  async findAll(activeOnly: boolean = true): Promise<SystemDocument[]> {
    const cacheKey = activeOnly ? CACHE_KEY : `${CACHE_KEY}:all`;

    const cached = await this.cacheManager.get<SystemDocument[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const filter = activeOnly ? { isActive: true } : {};
    const systems = await this.systemModel.find(filter).sort({ createdAt: -1 });

    await this.cacheManager.set(cacheKey, systems, CACHE_TTL);

    return systems;
  }

  async findOne(id: string): Promise<SystemDocument> {
    const system = await this.systemModel.findById(id);

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
    );

    await this.cacheManager.del(CACHE_KEY);
    await this.cacheManager.del(`${CACHE_KEY}:all`);

    return updated!;
  }

  async remove(id: string): Promise<void> {
    const system = await this.systemModel.findById(id);

    if (!system) {
      throw new EntityNotFoundException('System', id);
    }

    // Hard delete - actually remove from database
    await this.systemModel.findByIdAndDelete(id);

    await this.cacheManager.del(CACHE_KEY);
    await this.cacheManager.del(`${CACHE_KEY}:all`);
  }
}



