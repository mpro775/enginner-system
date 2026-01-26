import { Injectable, Inject, forwardRef } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, FilterQuery, Types } from "mongoose";
import {
  MaintenanceRequest,
  MaintenanceRequestDocument,
} from "./schemas/maintenance-request.schema";
import { Machine, MachineDocument } from "../machines/schemas/machine.schema";
import {
  CreateMaintenanceRequestDto,
  UpdateMaintenanceRequestDto,
  StopRequestDto,
  AddNoteDto,
  AddHealthSafetyNoteDto,
  AddProjectManagerNoteDto,
  FilterRequestsDto,
  CompleteRequestDto,
} from "./dto";
import {
  EntityNotFoundException,
  InvalidOperationException,
  ForbiddenAccessException,
} from "../../common/exceptions";
import {
  RequestStatus,
  Role,
  AuditAction,
  MaintenanceType,
} from "../../common/enums";
import {
  createPaginationMeta,
  getSkipAndLimit,
  getSortOptions,
  PaginatedResult,
} from "../../common/utils/pagination.util";
import { NotificationsGateway } from "../notifications/notifications.gateway";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { ScheduledTasksService } from "../scheduled-tasks/scheduled-tasks.service";
import { User, UserDocument } from "../users/schemas/user.schema";

@Injectable()
export class MaintenanceRequestsService {
  constructor(
    @InjectModel(MaintenanceRequest.name)
    private requestModel: Model<MaintenanceRequestDocument>,
    @InjectModel(Machine.name)
    private machineModel: Model<MachineDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @Inject(forwardRef(() => NotificationsGateway))
    private notificationsGateway: NotificationsGateway,
    @Inject(forwardRef(() => AuditLogsService))
    private auditLogsService: AuditLogsService,
    @Inject(forwardRef(() => ScheduledTasksService))
    private scheduledTasksService: ScheduledTasksService
  ) {}

  async create(
    createDto: CreateMaintenanceRequestDto,
    user: { userId: string; name: string }
  ): Promise<MaintenanceRequestDocument> {
    // Validate components if maintainAllComponents is false
    if (createDto.maintainAllComponents === false) {
      if (
        !createDto.selectedComponents ||
        createDto.selectedComponents.length === 0
      ) {
        throw new InvalidOperationException(
          "Selected components are required when maintainAllComponents is false"
        );
      }

      // Verify that the machine exists and has the selected components
      const machine = await this.machineModel.findById(createDto.machineId);
      if (!machine) {
        throw new EntityNotFoundException("Machine", createDto.machineId);
      }

      if (!machine.components || machine.components.length === 0) {
        throw new InvalidOperationException(
          "The selected machine does not have any components"
        );
      }

      // Check if all selected components exist in the machine
      const invalidComponents = createDto.selectedComponents.filter(
        (component) => !machine.components?.includes(component)
      );

      if (invalidComponents.length > 0) {
        throw new InvalidOperationException(
          `The following components are not valid for this machine: ${invalidComponents.join(", ")}`
        );
      }
    }

    // Set default value for maintainAllComponents if not provided
    const maintainAllComponents = createDto.maintainAllComponents ?? true;

    // Generate request code
    const requestCode = await this.generateRequestCode(
      createDto.maintenanceType
    );

    // Ensure engineerId is converted to ObjectId for consistent storage and querying
    const engineerId = Types.ObjectId.isValid(user.userId)
      ? new Types.ObjectId(user.userId)
      : user.userId;

    const request = new this.requestModel({
      ...createDto,
      maintainAllComponents,
      requestCode,
      engineerId,
      status: RequestStatus.IN_PROGRESS,
      openedAt: new Date(),
    });

    const saved = await request.save();
    const populated = await this.populateRequest(saved._id.toString());

    // If scheduledTaskId is provided, mark the task as completed
    if (createDto.scheduledTaskId) {
      await this.scheduledTasksService.markAsCompleted(
        createDto.scheduledTaskId,
        saved._id.toString()
      );
    }

    // Send real-time notification
    this.notificationsGateway.notifyRequestCreated(populated);

    // Log the action
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.CREATE,
      entity: "MaintenanceRequest",
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
    user: { userId: string; role: string }
  ): Promise<PaginatedResult<MaintenanceRequestDocument>> {
    const { skip, limit } = getSkipAndLimit(filterDto);
    const sortOptions = getSortOptions(filterDto);

    const filter = this.buildFilter(filterDto, user);

    const [requests, total] = await Promise.all([
      this.requestModel
        .find(filter)
        .populate("engineerId", "name email")
        .populate("consultantId", "name email")
        .populate("healthSafetySupervisorId", "name email")
        .populate("locationId", "name")
        .populate("departmentId", "name")
        .populate("systemId", "name")
        .populate("machineId", "name components description")
        .populate("deletedBy", "name email")
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
    user: { userId: string; role: string }
  ): Promise<MaintenanceRequestDocument> {
    const request = await this.populateRequest(id);

    if (!request) {
      throw new EntityNotFoundException("Maintenance Request", id);
    }

    // Engineers can only see their own requests
    if (
      user.role === Role.ENGINEER &&
      request.engineerId._id.toString() !== user.userId
    ) {
      throw new ForbiddenAccessException("You can only view your own requests");
    }

    return request;
  }

  async update(
    id: string,
    updateDto: UpdateMaintenanceRequestDto,
    user: { userId: string; name: string; role: string }
  ): Promise<MaintenanceRequestDocument> {
    const request = await this.requestModel.findById(id);

    if (!request) {
      throw new EntityNotFoundException("Maintenance Request", id);
    }

    // Only the engineer who created the request can update it
    if (request.engineerId.toString() !== user.userId) {
      throw new ForbiddenAccessException(
        "You can only update your own requests"
      );
    }

    // Can only update requests in in_progress status
    if (request.status !== RequestStatus.IN_PROGRESS) {
      throw new InvalidOperationException(
        "Can only update requests that are in progress"
      );
    }

    const previousValues: Record<string, unknown> = {
      maintenanceType: request.maintenanceType,
      reasonText: request.reasonText,
      engineerNotes: request.engineerNotes,
    };
    if (updateDto.requestNeeds !== undefined) {
      previousValues.requestNeeds = request.requestNeeds;
    }
    if (updateDto.implementedWork !== undefined) {
      previousValues.implementedWork = request.implementedWork;
    }

    await this.requestModel.findByIdAndUpdate(id, updateDto);

    // Log the action
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.UPDATE,
      entity: "MaintenanceRequest",
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
    user: { userId: string; name: string }
  ): Promise<MaintenanceRequestDocument> {
    const request = await this.requestModel.findById(id);

    if (!request) {
      throw new EntityNotFoundException("Maintenance Request", id);
    }

    if (request.engineerId.toString() !== user.userId) {
      throw new ForbiddenAccessException("You can only stop your own requests");
    }

    if (request.status !== RequestStatus.IN_PROGRESS) {
      throw new InvalidOperationException(
        "Can only stop requests that are in progress"
      );
    }

    const previousStatus = request.status;

    const updatedRequest = await this.requestModel.findByIdAndUpdate(
      id,
      {
        status: RequestStatus.STOPPED,
        stopReason: stopDto.stopReason,
        stoppedAt: new Date(),
      },
      { new: true }
    );

    // If request was linked to a scheduled task, mark it as pending again
    if (updatedRequest?.scheduledTaskId) {
      await this.scheduledTasksService.markAsPending(
        updatedRequest.scheduledTaskId.toString()
      );
    }

    // Log the action
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.STATUS_CHANGE,
      entity: "MaintenanceRequest",
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
    user: { userId: string; name: string }
  ): Promise<MaintenanceRequestDocument> {
    const request = await this.requestModel.findById(id);

    if (!request) {
      throw new EntityNotFoundException("Maintenance Request", id);
    }

    const previousNotes = request.consultantNotes;
    const formattedNote = this.formatNoteWithAuthor(
      noteDto.consultantNotes,
      user.name
    );

    await this.requestModel.findByIdAndUpdate(id, {
      consultantId: user.userId,
      consultantNotes: formattedNote,
    });

    // Log the action
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.UPDATE,
      entity: "MaintenanceRequest",
      entityId: id,
      changes: {
        consultantNotes: formattedNote,
      },
      previousValues: { consultantNotes: previousNotes },
    });

    const updated = await this.populateRequest(id);

    // Notify about update
    this.notificationsGateway.notifyRequestUpdated(updated);

    return updated;
  }

  async addHealthSafetyNote(
    id: string,
    noteDto: AddHealthSafetyNoteDto,
    user: { userId: string; name: string }
  ): Promise<MaintenanceRequestDocument> {
    const request = await this.requestModel.findById(id);

    if (!request) {
      throw new EntityNotFoundException("Maintenance Request", id);
    }

    const previousNotes = request.healthSafetyNotes;
    const formattedNote = this.formatNoteWithAuthor(
      noteDto.healthSafetyNotes,
      user.name
    );

    await this.requestModel.findByIdAndUpdate(id, {
      healthSafetySupervisorId: user.userId,
      healthSafetyNotes: formattedNote,
    });

    // Log the action
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.UPDATE,
      entity: "MaintenanceRequest",
      entityId: id,
      changes: {
        healthSafetyNotes: formattedNote,
      },
      previousValues: {
        healthSafetyNotes: previousNotes,
      },
    });

    const updated = await this.populateRequest(id);

    // Notify about note addition
    this.notificationsGateway.notifyRequestUpdated(updated);

    return updated;
  }

  async addProjectManagerNote(
    id: string,
    noteDto: AddProjectManagerNoteDto,
    user: { userId: string; name: string }
  ): Promise<MaintenanceRequestDocument> {
    const request = await this.requestModel.findById(id);

    if (!request) {
      throw new EntityNotFoundException("Maintenance Request", id);
    }

    const previousNotes = request.projectManagerNotes;
    const formattedNote = this.formatNoteWithAuthor(
      noteDto.projectManagerNotes,
      user.name
    );

    await this.requestModel.findByIdAndUpdate(id, {
      projectManagerId: user.userId,
      projectManagerNotes: formattedNote,
    });

    // Log the action
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.UPDATE,
      entity: "MaintenanceRequest",
      entityId: id,
      changes: {
        projectManagerNotes: formattedNote,
      },
      previousValues: {
        projectManagerNotes: previousNotes,
      },
    });

    const updated = await this.populateRequest(id);

    // Notify about note addition
    this.notificationsGateway.notifyRequestUpdated(updated);

    return updated;
  }

  async complete(
    id: string,
    completeDto: CompleteRequestDto,
    user: { userId: string; name: string }
  ): Promise<MaintenanceRequestDocument> {
    const request = await this.requestModel.findById(id);

    if (!request) {
      throw new EntityNotFoundException("Maintenance Request", id);
    }

    if (request.engineerId.toString() !== user.userId) {
      throw new ForbiddenAccessException(
        "You can only complete your own requests"
      );
    }

    if (request.status !== RequestStatus.IN_PROGRESS) {
      throw new InvalidOperationException(
        "Can only complete requests that are in progress"
      );
    }

    const previousStatus = request.status;
    const previousImplementedWork = request.implementedWork;
    const implementedWorkValue = (completeDto.implementedWork ?? "").trim();
    const implementedWorkToStore =
      implementedWorkValue === "" ? undefined : implementedWorkValue;

    await this.requestModel.findByIdAndUpdate(id, {
      status: RequestStatus.COMPLETED,
      closedAt: new Date(),
      implementedWork: implementedWorkToStore,
    });

    // Log the action
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.STATUS_CHANGE,
      entity: "MaintenanceRequest",
      entityId: id,
      changes: {
        status: RequestStatus.COMPLETED,
        implementedWork: implementedWorkToStore,
      },
      previousValues: {
        status: previousStatus,
        implementedWork: previousImplementedWork,
      },
    });

    const updated = await this.populateRequest(id);

    // Notify about completion
    this.notificationsGateway.notifyRequestCompleted(updated);

    return updated;
  }

  private async generateRequestCode(
    maintenanceType: MaintenanceType
  ): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");

    const prefix =
      maintenanceType === MaintenanceType.PREVENTIVE
        ? "PM"
        : maintenanceType === MaintenanceType.EMERGENCY
          ? "EM"
          : "MR";

    // Find the last request of this month
    const lastRequest = await this.requestModel
      .findOne({
        requestCode: { $regex: `^${prefix}-${year}${month}` },
      })
      .sort({ requestCode: -1 });

    let sequence = 1;
    if (lastRequest) {
      const lastSequence = parseInt(lastRequest.requestCode.split("-")[2], 10);
      sequence = lastSequence + 1;
    }

    return `${prefix}-${year}${month}-${String(sequence).padStart(4, "0")}`;
  }

  private buildFilter(
    filterDto: FilterRequestsDto,
    user: { userId: string; role: string }
  ): FilterQuery<MaintenanceRequestDocument> {
    const filter: FilterQuery<MaintenanceRequestDocument> = {
      deletedAt: null, // استبعاد المحذوفين ناعماً
    };

    // Engineers can only see their own requests (always apply engineerId filter)
    // Admins and Consultants can see all requests
    if (user.role === Role.ENGINEER) {
      // Support both String and ObjectId formats
      filter.engineerId = { 
        $in: [
          user.userId,
          Types.ObjectId.isValid(user.userId) ? new Types.ObjectId(user.userId) : null
        ].filter(Boolean)
      } as any;
    }

    if (filterDto.status) {
      filter.status = filterDto.status;
    }

    // Allow Admins and Consultants to filter by specific engineer
    if (filterDto.engineerId && user.role !== Role.ENGINEER) {
      // Support both String and ObjectId formats
      filter.engineerId = { 
        $in: [
          filterDto.engineerId,
          Types.ObjectId.isValid(filterDto.engineerId) ? new Types.ObjectId(filterDto.engineerId) : null
        ].filter(Boolean)
      } as any;
    }

    if (filterDto.consultantId) {
      // Support both String and ObjectId formats
      filter.consultantId = { 
        $in: [
          filterDto.consultantId,
          Types.ObjectId.isValid(filterDto.consultantId) ? new Types.ObjectId(filterDto.consultantId) : null
        ].filter(Boolean)
      } as any;
    }

    if (filterDto.locationId) {
      // Support both String and ObjectId formats
      filter.locationId = { 
        $in: [
          filterDto.locationId,
          Types.ObjectId.isValid(filterDto.locationId) ? new Types.ObjectId(filterDto.locationId) : null
        ].filter(Boolean)
      } as any;
    }

    if (filterDto.departmentId) {
      // Support both String and ObjectId formats
      filter.departmentId = { 
        $in: [
          filterDto.departmentId,
          Types.ObjectId.isValid(filterDto.departmentId) ? new Types.ObjectId(filterDto.departmentId) : null
        ].filter(Boolean)
      } as any;
    }

    if (filterDto.systemId) {
      // Support both String and ObjectId formats
      filter.systemId = { 
        $in: [
          filterDto.systemId,
          Types.ObjectId.isValid(filterDto.systemId) ? new Types.ObjectId(filterDto.systemId) : null
        ].filter(Boolean)
      } as any;
    }

    if (filterDto.machineId) {
      // Support both String and ObjectId formats
      filter.machineId = { 
        $in: [
          filterDto.machineId,
          Types.ObjectId.isValid(filterDto.machineId) ? new Types.ObjectId(filterDto.machineId) : null
        ].filter(Boolean)
      } as any;
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

  private formatNoteWithAuthor(note: string, authorName: string): string {
    // إزالة أي اسم موجود مسبقاً في نهاية الملاحظة
    const cleanedNote = note.replace(/\s*\([^)]+\)\s*$/, '').trim();
    return `${cleanedNote} (${authorName})`;
  }

  private async populateRequest(
    id: string
  ): Promise<MaintenanceRequestDocument> {
    return this.requestModel
      .findById(id)
      .populate("engineerId", "name email")
      .populate("consultantId", "name email")
      .populate("healthSafetySupervisorId", "name email")
      .populate("locationId", "name")
      .populate("departmentId", "name")
      .populate("systemId", "name")
      .populate("machineId", "name components description")
      .populate("deletedBy", "name email")
      .exec() as Promise<MaintenanceRequestDocument>;
  }

  // Methods for statistics
  async countByStatus(): Promise<Record<string, number>> {
    const results = await this.requestModel.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    return results.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});
  }

  async countByMaintenanceType(): Promise<Record<string, number>> {
    const results = await this.requestModel.aggregate([
      { $group: { _id: "$maintenanceType", count: { $sum: 1 } } },
    ]);

    return results.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});
  }

  async softDelete(
    id: string,
    user: { userId: string; name: string }
  ): Promise<void> {
    const request = await this.requestModel.findById(id);
    if (!request || request.deletedAt) {
      throw new EntityNotFoundException("Maintenance Request", id);
    }

    await this.requestModel.findByIdAndUpdate(id, {
      deletedAt: new Date(),
      deletedBy: user.userId,
    });

    // Log the action
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.SOFT_DELETE,
      entity: "MaintenanceRequest",
      entityId: id,
      changes: { requestCode: request.requestCode },
    });
  }

  async hardDelete(
    id: string,
    user: { userId: string; name: string }
  ): Promise<void> {
    const request = await this.requestModel.findById(id);
    if (!request) {
      throw new EntityNotFoundException("Maintenance Request", id);
    }

    await this.requestModel.findByIdAndDelete(id);

    // Log the action
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.HARD_DELETE,
      entity: "MaintenanceRequest",
      entityId: id,
      changes: { requestCode: request.requestCode },
    });
  }

  async restore(
    id: string,
    user: { userId: string; name: string }
  ): Promise<MaintenanceRequestDocument> {
    const request = await this.requestModel.findById(id);
    if (!request || !request.deletedAt) {
      throw new EntityNotFoundException("Maintenance Request", id);
    }

    const restored = await this.requestModel.findByIdAndUpdate(
      id,
      { $unset: { deletedAt: 1, deletedBy: 1 } },
      { new: true }
    );

    if (!restored) {
      throw new EntityNotFoundException("Maintenance Request", id);
    }

    const populated = await this.populateRequest(id);

    // Log the action
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.RESTORE,
      entity: "MaintenanceRequest",
      entityId: id,
      changes: { requestCode: request.requestCode },
    });

    return populated;
  }

  async findDeleted(
    filterDto: FilterRequestsDto
  ): Promise<PaginatedResult<MaintenanceRequestDocument>> {
    const { skip, limit } = getSkipAndLimit(filterDto);
    const sortOptions = getSortOptions(filterDto);

    const filter: FilterQuery<MaintenanceRequestDocument> = {
      deletedAt: { $ne: null },
    };

    if (filterDto.status) {
      filter.status = filterDto.status;
    }

    if (filterDto.engineerId) {
      // Support both String and ObjectId formats
      filter.engineerId = { 
        $in: [
          filterDto.engineerId,
          Types.ObjectId.isValid(filterDto.engineerId) ? new Types.ObjectId(filterDto.engineerId) : null
        ].filter(Boolean)
      } as any;
    }

    if (filterDto.consultantId) {
      // Support both String and ObjectId formats
      filter.consultantId = { 
        $in: [
          filterDto.consultantId,
          Types.ObjectId.isValid(filterDto.consultantId) ? new Types.ObjectId(filterDto.consultantId) : null
        ].filter(Boolean)
      } as any;
    }

    if (filterDto.locationId) {
      // Support both String and ObjectId formats
      filter.locationId = { 
        $in: [
          filterDto.locationId,
          Types.ObjectId.isValid(filterDto.locationId) ? new Types.ObjectId(filterDto.locationId) : null
        ].filter(Boolean)
      } as any;
    }

    if (filterDto.departmentId) {
      // Support both String and ObjectId formats
      filter.departmentId = { 
        $in: [
          filterDto.departmentId,
          Types.ObjectId.isValid(filterDto.departmentId) ? new Types.ObjectId(filterDto.departmentId) : null
        ].filter(Boolean)
      } as any;
    }

    if (filterDto.systemId) {
      // Support both String and ObjectId formats
      filter.systemId = { 
        $in: [
          filterDto.systemId,
          Types.ObjectId.isValid(filterDto.systemId) ? new Types.ObjectId(filterDto.systemId) : null
        ].filter(Boolean)
      } as any;
    }

    if (filterDto.machineId) {
      // Support both String and ObjectId formats
      filter.machineId = { 
        $in: [
          filterDto.machineId,
          Types.ObjectId.isValid(filterDto.machineId) ? new Types.ObjectId(filterDto.machineId) : null
        ].filter(Boolean)
      } as any;
    }

    if (filterDto.maintenanceType) {
      filter.maintenanceType = filterDto.maintenanceType;
    }

    const [requests, total] = await Promise.all([
      this.requestModel
        .find(filter)
        .populate("engineerId", "name email")
        .populate("consultantId", "name email")
        .populate("healthSafetySupervisorId", "name email")
        .populate("locationId", "name")
        .populate("departmentId", "name")
        .populate("systemId", "name")
        .populate("machineId", "name components description")
        .populate("deletedBy", "name email")
        .sort({ deletedAt: -1, ...sortOptions })
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

  async getModel(): Promise<Model<MaintenanceRequestDocument>> {
    return this.requestModel;
  }
}
