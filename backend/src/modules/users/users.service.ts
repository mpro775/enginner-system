import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto, UpdateUserDto, FilterUsersDto } from './dto';
import {
  EntityNotFoundException,
  DuplicateEntityException,
} from '../../common/exceptions';
import {
  createPaginationMeta,
  getSkipAndLimit,
  getSortOptions,
  PaginatedResult,
} from '../../common/utils/pagination.util';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction } from '../../common/enums';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private auditLogsService: AuditLogsService,
  ) {}

  async create(
    createUserDto: CreateUserDto,
    currentUser: { userId: string; name: string },
  ): Promise<UserDocument> {
    // Check if email already exists
    const existingUser = await this.userModel.findOne({
      email: createUserDto.email.toLowerCase(),
    });

    if (existingUser) {
      throw new DuplicateEntityException('User', 'email', createUserDto.email);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 12);

    const userData: any = {
      ...createUserDto,
      email: createUserDto.email.toLowerCase(),
      password: hashedPassword,
    };
    if (createUserDto.departmentIds?.length) {
      userData.departmentIds = createUserDto.departmentIds.map((id) => new Types.ObjectId(id));
    } else {
      userData.departmentIds = [];
    }
    delete userData.departmentId;
    const user = new this.userModel(userData);

    const savedUser = await user.save();

    // Log the action
    await this.auditLogsService.create({
      userId: currentUser.userId,
      userName: currentUser.name,
      action: AuditAction.CREATE,
      entity: 'User',
      entityId: savedUser._id.toString(),
      changes: {
        name: savedUser.name,
        email: savedUser.email,
        role: savedUser.role,
      },
    });

    return savedUser;
  }

  async findAll(filterDto: FilterUsersDto): Promise<PaginatedResult<UserDocument>> {
    const { skip, limit } = getSkipAndLimit(filterDto);
    const sortOptions = getSortOptions(filterDto);

    const filter: FilterQuery<UserDocument> = {
      deletedAt: null, // استبعاد المحذوفين ناعماً
    };

    if (filterDto.search) {
      filter.$or = [
        { name: { $regex: filterDto.search, $options: 'i' } },
        { email: { $regex: filterDto.search, $options: 'i' } },
      ];
    }

    if (filterDto.role) {
      filter.role = filterDto.role;
    }

    if (filterDto.departmentId && Types.ObjectId.isValid(filterDto.departmentId)) {
      filter.departmentIds = { $in: [new Types.ObjectId(filterDto.departmentId)] };
    }

    if (filterDto.isActive !== undefined) {
      filter.isActive = filterDto.isActive;
    }

    const [users, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('-password -refreshToken')
        .populate('departmentIds', 'name')
        .populate('deletedBy', 'name email')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments(filter),
    ]);

    return {
      data: users,
      meta: createPaginationMeta(total, filterDto.page || 1, limit),
    };
  }

  async findOne(id: string): Promise<UserDocument> {
    const user = await this.userModel
      .findById(id)
      .select('-password -refreshToken')
      .populate('departmentIds', 'name');

    if (!user) {
      throw new EntityNotFoundException('User', id);
    }

    return user;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() });
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    currentUser: { userId: string; name: string },
  ): Promise<UserDocument> {
    const user = await this.userModel.findById(id);

    if (!user) {
      throw new EntityNotFoundException('User', id);
    }

    // Check if email is being changed and already exists
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.userModel.findOne({
        email: updateUserDto.email.toLowerCase(),
        _id: { $ne: id },
      });

      if (existingUser) {
        throw new DuplicateEntityException('User', 'email', updateUserDto.email);
      }
    }

    // Store previous values for audit
    const previousValues = {
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };

    // Hash password if being updated
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 12);
    }

    // Update email to lowercase
    if (updateUserDto.email) {
      updateUserDto.email = updateUserDto.email.toLowerCase();
    }

    const updateData: any = { ...updateUserDto };
    if (updateUserDto.departmentIds !== undefined) {
      updateData.departmentIds = (updateUserDto.departmentIds || []).map((id) => new Types.ObjectId(id));
    }
    delete updateData.departmentId;

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .select('-password -refreshToken')
      .populate('departmentIds', 'name');

    // Log the action
    await this.auditLogsService.create({
      userId: currentUser.userId,
      userName: currentUser.name,
      action: AuditAction.UPDATE,
      entity: 'User',
      entityId: id,
      changes: updateUserDto as Record<string, unknown>,
      previousValues,
    });

    return updatedUser!;
  }

  async toggleStatus(
    id: string,
    currentUser: { userId: string; name: string },
  ): Promise<UserDocument> {
    const user = await this.userModel.findById(id);

    if (!user) {
      throw new EntityNotFoundException('User', id);
    }

    const newStatus = !user.isActive;

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, { isActive: newStatus }, { new: true })
      .select('-password -refreshToken')
      .populate('departmentIds', 'name');

    // Log the action
    await this.auditLogsService.create({
      userId: currentUser.userId,
      userName: currentUser.name,
      action: AuditAction.STATUS_CHANGE,
      entity: 'User',
      entityId: id,
      changes: { isActive: newStatus },
      previousValues: { isActive: user.isActive },
    });

    return updatedUser!;
  }

  async softDelete(
    id: string,
    currentUser: { userId: string; name: string },
  ): Promise<void> {
    const user = await this.userModel.findById(id);

    if (!user || user.deletedAt) {
      throw new EntityNotFoundException('User', id);
    }

    await this.userModel.findByIdAndUpdate(id, {
      deletedAt: new Date(),
      deletedBy: currentUser.userId,
    });

    // Log the action
    await this.auditLogsService.create({
      userId: currentUser.userId,
      userName: currentUser.name,
      action: AuditAction.SOFT_DELETE,
      entity: 'User',
      entityId: id,
      previousValues: {
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  }

  async hardDelete(
    id: string,
    currentUser: { userId: string; name: string },
  ): Promise<void> {
    const user = await this.userModel.findById(id);

    if (!user) {
      throw new EntityNotFoundException('User', id);
    }

    await this.userModel.findByIdAndDelete(id);

    // Log the action
    await this.auditLogsService.create({
      userId: currentUser.userId,
      userName: currentUser.name,
      action: AuditAction.HARD_DELETE,
      entity: 'User',
      entityId: id,
      previousValues: {
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  }

  async restore(
    id: string,
    currentUser: { userId: string; name: string },
  ): Promise<UserDocument> {
    const user = await this.userModel.findById(id);

    if (!user || !user.deletedAt) {
      throw new EntityNotFoundException('User', id);
    }

    const restored = await this.userModel
      .findByIdAndUpdate(
        id,
        { $unset: { deletedAt: 1, deletedBy: 1 } },
        { new: true }
      )
      .select('-password -refreshToken')
      .populate('departmentIds', 'name');

    if (!restored) {
      throw new EntityNotFoundException('User', id);
    }

    // Log the action
    await this.auditLogsService.create({
      userId: currentUser.userId,
      userName: currentUser.name,
      action: AuditAction.RESTORE,
      entity: 'User',
      entityId: id,
      changes: {
        name: restored.name,
        email: restored.email,
      },
    });

    return restored;
  }

  async findDeleted(filterDto: FilterUsersDto): Promise<PaginatedResult<UserDocument>> {
    const { skip, limit } = getSkipAndLimit(filterDto);
    const sortOptions = getSortOptions(filterDto);

    const filter: FilterQuery<UserDocument> = {
      deletedAt: { $ne: null },
    };

    if (filterDto.search) {
      filter.$or = [
        { name: { $regex: filterDto.search, $options: 'i' } },
        { email: { $regex: filterDto.search, $options: 'i' } },
      ];
    }

    if (filterDto.role) {
      filter.role = filterDto.role;
    }

    if (filterDto.departmentId && Types.ObjectId.isValid(filterDto.departmentId)) {
      filter.departmentIds = { $in: [new Types.ObjectId(filterDto.departmentId)] };
    }

    const [users, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('-password -refreshToken')
        .populate('departmentIds', 'name')
        .populate('deletedBy', 'name email')
        .sort({ deletedAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments(filter),
    ]);

    return {
      data: users,
      meta: createPaginationMeta(total, filterDto.page || 1, limit),
    };
  }

  // Keep for backward compatibility
  async remove(
    id: string,
    currentUser: { userId: string; name: string },
  ): Promise<void> {
    return this.softDelete(id, currentUser);
  }

  async getEngineers(): Promise<UserDocument[]> {
    return this.userModel
      .find({ role: 'engineer', isActive: true, deletedAt: null })
      .select('name email departmentIds')
      .populate('departmentIds', 'name')
      .sort({ name: 1 });
  }

  async getConsultants(): Promise<UserDocument[]> {
    return this.userModel
      .find({ role: 'consultant', isActive: true, deletedAt: null })
      .select('name email')
      .sort({ name: 1 });
  }
}



