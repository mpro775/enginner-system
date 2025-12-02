import { Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Model } from 'mongoose';
import { Location, LocationDocument } from './schemas/location.schema';
import { CreateLocationDto, UpdateLocationDto } from './dto';
import {
  EntityNotFoundException,
  DuplicateEntityException,
} from '../../common/exceptions';

const CACHE_KEY = 'locations:all';
const CACHE_TTL = 300000; // 5 minutes

@Injectable()
export class LocationsService {
  constructor(
    @InjectModel(Location.name) private locationModel: Model<LocationDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
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

    const filter = activeOnly ? { isActive: true } : {};
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

  async remove(id: string): Promise<void> {
    const location = await this.locationModel.findById(id);

    if (!location) {
      throw new EntityNotFoundException('Location', id);
    }

    // Hard delete - actually remove from database
    await this.locationModel.findByIdAndDelete(id);

    // Invalidate cache
    await this.cacheManager.del(CACHE_KEY);
    await this.cacheManager.del(`${CACHE_KEY}:all`);
  }
}



