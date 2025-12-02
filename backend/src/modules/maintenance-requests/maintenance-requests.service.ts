import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import {
  MaintenanceRequest,
  MaintenanceRequestDocument,
} from './schemas/maintenance-request.schema';
import {
  CreateMaintenanceRequestDto,
  UpdateMaintenanceRequestDto,
  StopRequestDto,
  AddNoteDto,
  FilterRequestsDto,
} from './dto';
import {
  EntityNotFoundException,
  InvalidOperationException,
  ForbiddenAccessException,
} from '../../common/exceptions';
import { RequestStatus, Role, AuditAction } from '../../common/enums';
import {
  createPaginationMeta,
  getSkipAndLimit,
  getSortOptions,
  PaginatedResult,
} from '../../common/utils/pagination.util';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class MaintenanceRequestsService {
  constructor(
    @InjectModel(MaintenanceRequest.name)
    private requestModel: Model<MaintenanceRequestDocument>,
    @Inject(forwardRef(() => NotificationsGateway))
    private notificationsGateway: NotificationsGateway,
    @Inject(forwardRef(() => AuditLogsService))
    private auditLogsService: AuditLogsService,
  ) {}

  async create(
    createDto: CreateMaintenanceRequestDto,
    user: { userId: string; name: string },
  ): Promise<MaintenanceRequestDocument> {
    // Generate request code
    const requestCode = await this.generateRequestCode();

    const request = new this.requestModel({
      ...createDto,
      requestCode,
      engineerId: user.userId,
      status: RequestStatus.IN_PROGRESS,
      openedAt: new Date(),
    });

    const saved = await request.save();
    const populated = await this.populateRequest(saved._id.toString());

    // Send real-time notification
    this.notificationsGateway.notifyRequestCreated(populated);

    // Log the action
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.CREATE,
      entity: 'MaintenanceRequest',
      entityId: saved._id.toString(),
      changes: {
        requestCode,
        maintenanceType: createDto.maintenanceType,
        status: RequestStatus.IN_PROGRESS,
      },
    });

    return populated;
  }

  async findAll(
    filterDto: FilterRequestsDto,
    user: { userId: string; role: string },
  ): Promise<PaginatedResult<MaintenanceRequestDocument>> {
    const { skip, limit } = getSkipAndLimit(filterDto);
    const sortOptions = getSortOptions(filterDto);

    const filter = this.buildFilter(filterDto, user);

    const [requests, total] = await Promise.all([
      this.requestModel
        .find(filter)
        .populate('engineerId', 'name email')
        .populate('consultantId', 'name email')
        .populate('locationId', 'name')
        .populate('departmentId', 'name')
        .populate('systemId', 'name')
        .populate('machineId', 'name')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.requestModel.countDocuments(filter),
    ]);

    return {
      data: requests,
      meta: createPaginationMeta(total, filterDto.page || 1, limit),
    };
  }

  async findOne(
    id: string,
    user: { userId: string; role: string },
  ): Promise<MaintenanceRequestDocument> {
    const request = await this.populateRequest(id);

    if (!request) {
      throw new EntityNotFoundException('Maintenance Request', id);
    }

    // Engineers can only see their own requests
    if (
      user.role === Role.ENGINEER &&
      request.engineerId._id.toString() !== user.userId
    ) {
      throw new ForbiddenAccessException('You can only view your own requests');
    }

    return request;
  }

  async update(
    id: string,
    updateDto: UpdateMaintenanceRequestDto,
    user: { userId: string; name: string; role: string },
  ): Promise<MaintenanceRequestDocument> {
    const request = await this.requestModel.findById(id);

    if (!request) {
      throw new EntityNotFoundException('Maintenance Request', id);
    }

    // Only the engineer who created the request can update it
    if (request.engineerId.toString() !== user.userId) {
      throw new ForbiddenAccessException('You can only update your own requests');
    }

    // Can only update requests in in_progress status
    if (request.status !== RequestStatus.IN_PROGRESS) {
      throw new InvalidOperationException(
        'Can only update requests that are in progress',
      );
    }

    const previousValues = {
      maintenanceType: request.maintenanceType,
      reasonText: request.reasonText,
      engineerNotes: request.engineerNotes,
    };

    await this.requestModel.findByIdAndUpdate(id, updateDto);

    // Log the action
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.UPDATE,
      entity: 'MaintenanceRequest',
      entityId: id,
      changes: updateDto as Record<string, unknown>,
      previousValues,
    });

    const updated = await this.populateRequest(id);

    // Notify about update
    this.notificationsGateway.notifyRequestUpdated(updated);

    return updated;
  }

  async stop(
    id: string,
    stopDto: StopRequestDto,
    user: { userId: string; name: string },
  ): Promise<MaintenanceRequestDocument> {
    const request = await this.requestModel.findById(id);

    if (!request) {
      throw new EntityNotFoundException('Maintenance Request', id);
    }

    if (request.engineerId.toString() !== user.userId) {
      throw new ForbiddenAccessException('You can only stop your own requests');
    }

    if (request.status !== RequestStatus.IN_PROGRESS) {
      throw new InvalidOperationException(
        'Can only stop requests that are in progress',
      );
    }

    const previousStatus = request.status;

    await this.requestModel.findByIdAndUpdate(id, {
      status: RequestStatus.STOPPED,
      stopReason: stopDto.stopReason,
      stoppedAt: new Date(),
    });

    // Log the action
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.STATUS_CHANGE,
      entity: 'MaintenanceRequest',
      entityId: id,
      changes: {
        status: RequestStatus.STOPPED,
        stopReason: stopDto.stopReason,
      },
      previousValues: { status: previousStatus },
    });

    const updated = await this.populateRequest(id);

    // Notify about stop
    this.notificationsGateway.notifyRequestUpdated(updated);

    return updated;
  }

  async addConsultantNote(
    id: string,
    noteDto: AddNoteDto,
    user: { userId: string; name: string },
  ): Promise<MaintenanceRequestDocument> {
    const request = await this.requestModel.findById(id);

    if (!request) {
      throw new EntityNotFoundException('Maintenance Request', id);
    }

    const previousNotes = request.consultantNotes;

    await this.requestModel.findByIdAndUpdate(id, {
      consultantId: user.userId,
      consultantNotes: noteDto.consultantNotes,
    });

    // Log the action
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.UPDATE,
      entity: 'MaintenanceRequest',
      entityId: id,
      changes: {
        consultantNotes: noteDto.consultantNotes,
      },
      previousValues: { consultantNotes: previousNotes },
    });

    const updated = await this.populateRequest(id);

    // Notify about update
    this.notificationsGateway.notifyRequestUpdated(updated);

    return updated;
  }

  async complete(
    id: string,
    user: { userId: string; name: string },
  ): Promise<MaintenanceRequestDocument> {
    const request = await this.requestModel.findById(id);

    if (!request) {
      throw new EntityNotFoundException('Maintenance Request', id);
    }

    if (request.engineerId.toString() !== user.userId) {
      throw new ForbiddenAccessException('You can only complete your own requests');
    }

    if (request.status !== RequestStatus.IN_PROGRESS) {
      throw new InvalidOperationException(
        'Can only complete requests that are in progress',
      );
    }

    const previousStatus = request.status;

    await this.requestModel.findByIdAndUpdate(id, {
      status: RequestStatus.COMPLETED,
      closedAt: new Date(),
    });

    // Log the action
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.STATUS_CHANGE,
      entity: 'MaintenanceRequest',
      entityId: id,
      changes: { status: RequestStatus.COMPLETED },
      previousValues: { status: previousStatus },
    });

    const updated = await this.populateRequest(id);

    // Notify about completion
    this.notificationsGateway.notifyRequestCompleted(updated);

    return updated;
  }

  private async generateRequestCode(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    // Find the last request of this month
    const lastRequest = await this.requestModel
      .findOne({
        requestCode: { $regex: `^MR-${year}${month}` },
      })
      .sort({ requestCode: -1 });

    let sequence = 1;
    if (lastRequest) {
      const lastSequence = parseInt(lastRequest.requestCode.split('-')[2], 10);
      sequence = lastSequence + 1;
    }

    return `MR-${year}${month}-${String(sequence).padStart(4, '0')}`;
  }

  private buildFilter(
    filterDto: FilterRequestsDto,
    user: { userId: string; role: string },
  ): FilterQuery<MaintenanceRequestDocument> {
    const filter: FilterQuery<MaintenanceRequestDocument> = {};

    // Engineers can only see their own requests
    if (user.role === Role.ENGINEER) {
      filter.engineerId = user.userId;
    }

    if (filterDto.status) {
      filter.status = filterDto.status;
    }

    if (filterDto.engineerId && user.role !== Role.ENGINEER) {
      filter.engineerId = filterDto.engineerId;
    }

    if (filterDto.consultantId) {
      filter.consultantId = filterDto.consultantId;
    }

    if (filterDto.locationId) {
      filter.locationId = filterDto.locationId;
    }

    if (filterDto.departmentId) {
      filter.departmentId = filterDto.departmentId;
    }

    if (filterDto.systemId) {
      filter.systemId = filterDto.systemId;
    }

    if (filterDto.machineId) {
      filter.machineId = filterDto.machineId;
    }

    if (filterDto.maintenanceType) {
      filter.maintenanceType = filterDto.maintenanceType;
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

  private async populateRequest(id: string): Promise<MaintenanceRequestDocument> {
    return this.requestModel
      .findById(id)
      .populate('engineerId', 'name email')
      .populate('consultantId', 'name email')
      .populate('locationId', 'name')
      .populate('departmentId', 'name')
      .populate('systemId', 'name')
      .populate('machineId', 'name')
      .exec() as Promise<MaintenanceRequestDocument>;
  }

  // Methods for statistics
  async countByStatus(): Promise<Record<string, number>> {
    const results = await this.requestModel.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    return results.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});
  }

  async countByMaintenanceType(): Promise<Record<string, number>> {
    const results = await this.requestModel.aggregate([
      { $group: { _id: '$maintenanceType', count: { $sum: 1 } } },
    ]);

    return results.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});
  }

  async getModel(): Promise<Model<MaintenanceRequestDocument>> {
    return this.requestModel;
  }
}



