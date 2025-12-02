import { Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Model } from 'mongoose';
import { Department, DepartmentDocument } from './schemas/department.schema';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto';
import {
  EntityNotFoundException,
  DuplicateEntityException,
} from '../../common/exceptions';

const CACHE_KEY = 'departments:all';
const CACHE_TTL = 300000; // 5 minutes

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectModel(Department.name) private departmentModel: Model<DepartmentDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async create(createDepartmentDto: CreateDepartmentDto): Promise<DepartmentDocument> {
    const existing = await this.departmentModel.findOne({
      name: { $regex: new RegExp(`^${createDepartmentDto.name}$`, 'i') },
    });

    if (existing) {
      throw new DuplicateEntityException('Department', 'name', createDepartmentDto.name);
    }

    const department = new this.departmentModel(createDepartmentDto);
    const saved = await department.save();

    // Invalidate cache for both activeOnly and all
    await this.cacheManager.del(CACHE_KEY);
    await this.cacheManager.del(`${CACHE_KEY}:all`);

    return saved;
  }

  async findAll(activeOnly: boolean = true): Promise<DepartmentDocument[]> {
    const cacheKey = activeOnly ? CACHE_KEY : `${CACHE_KEY}:all`;

    const cached = await this.cacheManager.get<DepartmentDocument[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const filter = activeOnly ? { isActive: true } : {};
    const departments = await this.departmentModel.find(filter).sort({ createdAt: -1 });

    await this.cacheManager.set(cacheKey, departments, CACHE_TTL);

    return departments;
  }

  async findOne(id: string): Promise<DepartmentDocument> {
    const department = await this.departmentModel.findById(id);

    if (!department) {
      throw new EntityNotFoundException('Department', id);
    }

    return department;
  }

  async update(id: string, updateDepartmentDto: UpdateDepartmentDto): Promise<DepartmentDocument> {
    const department = await this.departmentModel.findById(id);

    if (!department) {
      throw new EntityNotFoundException('Department', id);
    }

    if (updateDepartmentDto.name && updateDepartmentDto.name !== department.name) {
      const existing = await this.departmentModel.findOne({
        name: { $regex: new RegExp(`^${updateDepartmentDto.name}$`, 'i') },
        _id: { $ne: id },
      });

      if (existing) {
        throw new DuplicateEntityException('Department', 'name', updateDepartmentDto.name);
      }
    }

    const updated = await this.departmentModel.findByIdAndUpdate(
      id,
      updateDepartmentDto,
      { new: true },
    );

    await this.cacheManager.del(CACHE_KEY);
    await this.cacheManager.del(`${CACHE_KEY}:all`);

    return updated!;
  }

  async remove(id: string): Promise<void> {
    const department = await this.departmentModel.findById(id);

    if (!department) {
      throw new EntityNotFoundException('Department', id);
    }

    // Hard delete - actually remove from database
    await this.departmentModel.findByIdAndDelete(id);

    await this.cacheManager.del(CACHE_KEY);
    await this.cacheManager.del(`${CACHE_KEY}:all`);
  }
}



