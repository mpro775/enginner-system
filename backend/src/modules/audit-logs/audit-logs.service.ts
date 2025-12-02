import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';
import { FilterAuditLogsDto } from './dto/filter-audit-logs.dto';
import { AuditAction } from '../../common/enums';
import {
  createPaginationMeta,
  getSkipAndLimit,
  getSortOptions,
  PaginatedResult,
} from '../../common/utils/pagination.util';

export interface CreateAuditLogDto {
  userId: string;
  userName: string;
  action: AuditAction;
  entity: string;
  entityId?: string;
  changes?: Record<string, unknown>;
  previousValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
  ) {}

  async create(createDto: CreateAuditLogDto): Promise<AuditLogDocument> {
    const auditLog = new this.auditLogModel(createDto);
    return auditLog.save();
  }

  async findAll(
    filterDto: FilterAuditLogsDto,
  ): Promise<PaginatedResult<AuditLogDocument>> {
    const { skip, limit } = getSkipAndLimit(filterDto);
    const sortOptions = getSortOptions(filterDto);

    const filter = this.buildFilter(filterDto);

    const [logs, total] = await Promise.all([
      this.auditLogModel
        .find(filter)
        .populate('userId', 'name email')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.auditLogModel.countDocuments(filter),
    ]);

    return {
      data: logs,
      meta: createPaginationMeta(total, filterDto.page || 1, limit),
    };
  }

  async findByEntity(
    entity: string,
    entityId: string,
  ): Promise<AuditLogDocument[]> {
    return this.auditLogModel
      .find({ entity, entityId })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .exec();
  }

  private buildFilter(
    filterDto: FilterAuditLogsDto,
  ): FilterQuery<AuditLogDocument> {
    const filter: FilterQuery<AuditLogDocument> = {};

    if (filterDto.userId) {
      filter.userId = filterDto.userId;
    }

    if (filterDto.action) {
      filter.action = filterDto.action;
    }

    if (filterDto.entity) {
      filter.entity = filterDto.entity;
    }

    if (filterDto.entityId) {
      filter.entityId = filterDto.entityId;
    }

    if (filterDto.fromDate || filterDto.toDate) {
      filter.createdAt = {};
      if (filterDto.fromDate) {
        filter.createdAt.$gte = new Date(filterDto.fromDate);
      }
      if (filterDto.toDate) {
        filter.createdAt.$lte = new Date(filterDto.toDate);
      }
    }

    return filter;
  }
}





