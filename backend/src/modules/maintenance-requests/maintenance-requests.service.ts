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
  AddHealthSafetyNoteDto,
  AddProjectManagerNoteDto,
  FilterRequestsDto,
  CompleteRequestDto,
  AddRequestNoteDto,
  RejectCompletionDto,
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
  OPEN_REQUEST_STATUSES,
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
import { System, SystemDocument } from "../systems/schemas/system.schema";

@Injectable()
export class MaintenanceRequestsService {
  constructor(
    @InjectModel(MaintenanceRequest.name)
    private requestModel: Model<MaintenanceRequestDocument>,
    @InjectModel(Machine.name)
    private machineModel: Model<MachineDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(System.name)
    private systemModel: Model<SystemDocument>,
    @Inject(forwardRef(() => NotificationsGateway))
    private notificationsGateway: NotificationsGateway,
    @Inject(forwardRef(() => AuditLogsService))
    private auditLogsService: AuditLogsService,
    @Inject(forwardRef(() => ScheduledTasksService))
    private scheduledTasksService: ScheduledTasksService,
  ) {}

  async create(
    createDto: CreateMaintenanceRequestDto,
    user: { userId: string; name: string },
  ): Promise<MaintenanceRequestDocument> {
    const engineer = await this.userModel
      .findOne({
        _id: user.userId,
        role: Role.ENGINEER,
        isActive: true,
        deletedAt: null,
        departmentIds: new Types.ObjectId(createDto.departmentId),
      })
      .select("_id");
    if (!engineer) {
      throw new ForbiddenAccessException(
        "You can only create requests in your assigned departments",
      );
    }
    const [system, selectedMachine] = await Promise.all([
      this.systemModel.exists({
        _id: createDto.systemId,
        departmentIds: new Types.ObjectId(createDto.departmentId),
        isActive: true,
        deletedAt: null,
      }),
      this.machineModel.findOne({
        _id: createDto.machineId,
        systemId: new Types.ObjectId(createDto.systemId),
        isActive: true,
        deletedAt: null,
      }),
    ]);
    if (!system) throw new EntityNotFoundException("System", createDto.systemId);
    if (!selectedMachine) throw new EntityNotFoundException("Machine", createDto.machineId);

    // Validate components if maintainAllComponents is false
    if (createDto.maintainAllComponents === false) {
      if (
        !createDto.selectedComponents ||
        createDto.selectedComponents.length === 0
      ) {
        throw new InvalidOperationException(
          "Selected components are required when maintainAllComponents is false",
        );
      }

      // Verify that the machine exists and has the selected components
      const machine = selectedMachine;
      if (!machine) {
        throw new EntityNotFoundException("Machine", createDto.machineId);
      }

      if (!machine.components || machine.components.length === 0) {
        throw new InvalidOperationException(
          "The selected machine does not have any components",
        );
      }

      // Check if all selected components exist in the machine
      const invalidComponents = createDto.selectedComponents.filter(
        (component) => !machine.components?.includes(component),
      );

      if (invalidComponents.length > 0) {
        throw new InvalidOperationException(
          `The following components are not valid for this machine: ${invalidComponents.join(", ")}`,
        );
      }
    }

    // Set default value for maintainAllComponents if not provided
    const maintainAllComponents = createDto.maintainAllComponents ?? true;

    // Generate request code
    const requestCode = await this.generateRequestCode(
      createDto.maintenanceType,
    );

    // Ensure engineerId is converted to ObjectId for consistent storage and querying
    const engineerId = Types.ObjectId.isValid(user.userId)
      ? new Types.ObjectId(user.userId)
      : user.userId;

    const referenceIds = {
      locationId: new Types.ObjectId(createDto.locationId),
      departmentId: new Types.ObjectId(createDto.departmentId),
      systemId: new Types.ObjectId(createDto.systemId),
      machineId: new Types.ObjectId(createDto.machineId),
    };

    const { engineerNotes, ...requestData } = createDto;
    const initialNote = engineerNotes?.trim();
    const request = new this.requestModel({
      ...requestData,
      ...referenceIds,
      maintainAllComponents,
      requestCode,
      engineerId,
      requestNotes: initialNote
        ? [{
            body: initialNote,
            authorId: engineerId,
            authorName: user.name,
            authorRole: Role.ENGINEER,
            createdAt: new Date(),
          }]
        : [],
      status: RequestStatus.IN_PROGRESS,
      openedAt: new Date(),
    });

    const saved = await request.save();
    const populated = await this.populateRequest(saved._id.toString());

    // If scheduledTaskId is provided, mark the task as completed
    if (createDto.scheduledTaskId) {
      await this.scheduledTasksService.markAsCompleted(
        createDto.scheduledTaskId,
        saved._id.toString(),
      );
    }

    // Send real-time notification only to the engineer and scoped operational users.
    const targetIds = await this.getDepartmentNotificationUserIds(
      referenceIds.departmentId.toString(),
      [Role.CONSULTANT, Role.MAINTENANCE_MANAGER, Role.ADMIN],
    );
    targetIds.push(user.userId);
    this.notificationsGateway.notifyRequestCreated(populated, targetIds);

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
    user: { userId: string; role: string },
  ): Promise<PaginatedResult<MaintenanceRequestDocument>> {
    const { skip, limit } = getSkipAndLimit(filterDto);
    const sortOptions = getSortOptions(filterDto);

    const filter = await this.buildFilter(filterDto, user);

    const [requests, total] = await Promise.all([
      this.requestModel
        .find(filter)
        .populate("engineerId", "name email")
        .populate("consultantId", "name email")
        .populate("healthSafetySupervisorId", "name email")
        .populate("locationId", "name")
        .populate("floorId", "name")
        .populate("departmentId", "name")
        .populate("systemId", "name")
        .populate("machineId", "name components description")
        .populate("complaintId", "complaintCode reporterNameAr reporterNameEn")
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
    user: { userId: string; role: string },
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

    if (user.role === Role.CONSULTANT) {
      const departmentId = (request.departmentId as any)?._id?.toString?.() ||
        request.departmentId?.toString();
      const departmentIds = await this.getUserDepartmentIds(user.userId);
      if (!departmentId || !departmentIds.includes(departmentId)) {
        throw new ForbiddenAccessException(
          "This request is outside your assigned departments",
        );
      }
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
      throw new EntityNotFoundException("Maintenance Request", id);
    }

    // Only the engineer who created the request can update it
    if (request.engineerId.toString() !== user.userId) {
      throw new ForbiddenAccessException(
        "You can only update your own requests",
      );
    }

    // Can only update requests in in_progress status
    if (request.status !== RequestStatus.IN_PROGRESS) {
      throw new InvalidOperationException(
        "Can only update requests that are in progress",
      );
    }

    if (request.complaintId) {
      const immutableFields = [
        "locationId",
        "departmentId",
        "reasonText",
      ] as const;
      if (immutableFields.some((field) => updateDto[field] !== undefined)) {
        throw new InvalidOperationException(
          "Source fields inherited from a complaint cannot be edited",
        );
      }
    }

    const effectiveDepartmentId =
      updateDto.departmentId || request.departmentId.toString();
    const effectiveSystemId = updateDto.systemId || request.systemId.toString();
    const effectiveMachineId = updateDto.machineId || request.machineId.toString();
    const [engineerInDepartment, systemInDepartment, machineInSystem] =
      await Promise.all([
        this.userModel.exists({
          _id: user.userId,
          role: Role.ENGINEER,
          isActive: true,
          deletedAt: null,
          departmentIds: new Types.ObjectId(effectiveDepartmentId),
        }),
        this.systemModel.exists({
          _id: effectiveSystemId,
          departmentIds: new Types.ObjectId(effectiveDepartmentId),
          isActive: true,
          deletedAt: null,
        }),
        this.machineModel.exists({
          _id: effectiveMachineId,
          systemId: new Types.ObjectId(effectiveSystemId),
          isActive: true,
          deletedAt: null,
        }),
      ]);
    if (!engineerInDepartment) {
      throw new ForbiddenAccessException(
        "You can only update requests in your assigned departments",
      );
    }
    if (!systemInDepartment) {
      throw new InvalidOperationException(
        "System must be active and belong to the selected department",
      );
    }
    if (!machineInSystem) {
      throw new InvalidOperationException(
        "Machine must be active and belong to the selected system",
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

    const normalizedUpdate: Record<string, unknown> = { ...updateDto };
    const appendedEngineerNote = updateDto.engineerNotes?.trim();
    delete normalizedUpdate.engineerNotes;
    for (const field of [
      "locationId",
      "departmentId",
      "systemId",
      "machineId",
    ] as const) {
      if (updateDto[field]) {
        normalizedUpdate[field] = new Types.ObjectId(updateDto[field]);
      }
    }

    const updateOperation: Record<string, unknown> = { $set: normalizedUpdate };
    if (appendedEngineerNote) {
      updateOperation.$push = {
        requestNotes: {
          body: appendedEngineerNote,
          authorId: new Types.ObjectId(user.userId),
          authorName: user.name,
          authorRole: Role.ENGINEER,
          createdAt: new Date(),
        },
      };
    }
    await this.requestModel.findByIdAndUpdate(id, updateOperation);

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

    // The updating engineer receives the event in their user room.
    this.notificationsGateway.notifyRequestUpdated(updated, [user.userId]);

    return updated;
  }

  async stop(
    id: string,
    stopDto: StopRequestDto,
    user: { userId: string; name: string },
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
        "Can only stop requests that are in progress",
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
      { new: true },
    );

    // If request was linked to a scheduled task, mark it as pending again
    if (updatedRequest?.scheduledTaskId) {
      await this.scheduledTasksService.markAsPending(
        updatedRequest.scheduledTaskId.toString(),
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

    // Historical stop support remains internal; no role-wide broadcast.
    this.notificationsGateway.notifyRequestUpdated(updated, [user.userId]);

    return updated;
  }

  async addHealthSafetyNote(
    id: string,
    noteDto: AddHealthSafetyNoteDto,
    user: { userId: string; name: string },
  ): Promise<MaintenanceRequestDocument> {
    const request = await this.requestModel.findById(id);

    if (!request) {
      throw new EntityNotFoundException("Maintenance Request", id);
    }

    const previousNotes = request.healthSafetyNotes;
    const formattedNote = this.formatNoteWithAuthor(
      noteDto.healthSafetyNotes,
      user.name,
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

    this.notificationsGateway.notifyRequestUpdated(updated, [
      request.engineerId.toString(),
      user.userId,
    ]);

    return updated;
  }

  async addProjectManagerNote(
    id: string,
    noteDto: AddProjectManagerNoteDto,
    user: { userId: string; name: string },
  ): Promise<MaintenanceRequestDocument> {
    const request = await this.requestModel.findById(id);

    if (!request) {
      throw new EntityNotFoundException("Maintenance Request", id);
    }

    const previousNotes = request.projectManagerNotes;
    const formattedNote = this.formatNoteWithAuthor(
      noteDto.projectManagerNotes,
      user.name,
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

    this.notificationsGateway.notifyRequestUpdated(updated, [
      request.engineerId.toString(),
      user.userId,
    ]);

    return updated;
  }

  async submitCompletion(
    id: string,
    completeDto: CompleteRequestDto,
    user: { userId: string; name: string },
  ): Promise<MaintenanceRequestDocument> {
    const request = await this.requestModel.findById(id);

    if (!request) {
      throw new EntityNotFoundException("Maintenance Request", id);
    }

    if (request.engineerId.toString() !== user.userId) {
      throw new ForbiddenAccessException(
        "You can only complete your own requests",
      );
    }

    if (request.status !== RequestStatus.IN_PROGRESS) {
      throw new InvalidOperationException(
        "Can only complete requests that are in progress",
      );
    }

    const previousStatus = request.status;
    const previousImplementedWork = request.implementedWork;
    const implementedWorkValue = (completeDto.implementedWork ?? "").trim();
    const implementedWorkToStore =
      implementedWorkValue === "" ? undefined : implementedWorkValue;

    const requestedAt = new Date();
    await this.requestModel.findByIdAndUpdate(id, {
      status: RequestStatus.PENDING_CONSULTANT_APPROVAL,
      completionRequestedAt: requestedAt,
      completionRequestedBy: new Types.ObjectId(user.userId),
      $unset: { closedAt: 1 },
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
        status: RequestStatus.PENDING_CONSULTANT_APPROVAL,
        implementedWork: implementedWorkToStore,
      },
      previousValues: {
        status: previousStatus,
        implementedWork: previousImplementedWork,
      },
    });

    const updated = await this.populateRequest(id);

    const targetIds = await this.getDepartmentNotificationUserIds(
      request.departmentId.toString(),
      [Role.CONSULTANT, Role.ADMIN],
    );
    this.notificationsGateway.notifyCompletionPending(updated, targetIds);

    return updated;
  }

  async addRequestNote(
    id: string,
    dto: AddRequestNoteDto,
    user: { userId: string; name: string; role: string },
  ): Promise<MaintenanceRequestDocument> {
    const request = await this.requestModel.findOne({ _id: id, deletedAt: null });
    if (!request) throw new EntityNotFoundException("Maintenance Request", id);

    if (
      user.role === Role.ENGINEER &&
      request.engineerId.toString() !== user.userId
    ) {
      throw new ForbiddenAccessException("You can only add notes to your own requests");
    }
    if (user.role === Role.CONSULTANT) {
      const departmentIds = await this.getUserDepartmentIds(user.userId);
      if (!departmentIds.includes(request.departmentId.toString())) {
        throw new ForbiddenAccessException("This request is outside your assigned departments");
      }
    }
    if (
      user.role === Role.ENGINEER &&
      ![
        RequestStatus.IN_PROGRESS,
        RequestStatus.PENDING_CONSULTANT_APPROVAL,
      ].includes(request.status)
    ) {
      throw new InvalidOperationException("Notes cannot be added in the current status");
    }

    await this.requestModel.findByIdAndUpdate(id, {
      $push: {
        requestNotes: {
          body: dto.body.trim(),
          authorId: new Types.ObjectId(user.userId),
          authorName: user.name,
          authorRole: user.role,
          createdAt: new Date(),
        },
      },
    });
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.UPDATE,
      entity: "MaintenanceRequest",
      entityId: id,
      changes: { requestNoteAdded: true },
    });
    const updated = await this.populateRequest(id);
    this.notificationsGateway.notifyRequestUpdated(updated, [
      request.engineerId.toString(),
      user.userId,
    ]);
    return updated;
  }

  async approveCompletion(
    id: string,
    user: { userId: string; name: string; role: string },
  ): Promise<MaintenanceRequestDocument> {
    const request = await this.requestModel.findOne({ _id: id, deletedAt: null });
    if (!request) throw new EntityNotFoundException("Maintenance Request", id);
    const departmentIds = await this.getUserDepartmentIds(user.userId);
    if (!departmentIds.includes(request.departmentId.toString())) {
      throw new ForbiddenAccessException("This request is outside your assigned departments");
    }
    const approvedAt = new Date();
    const approved = await this.requestModel.findOneAndUpdate(
      { _id: id, status: RequestStatus.PENDING_CONSULTANT_APPROVAL },
      {
        status: RequestStatus.COMPLETED,
        closedAt: approvedAt,
        completionApprovedAt: approvedAt,
        completionApprovedBy: new Types.ObjectId(user.userId),
        completionApprovedByName: user.name,
      },
      { new: true },
    );
    if (!approved) {
      throw new InvalidOperationException("Completion approval was already processed");
    }
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.STATUS_CHANGE,
      entity: "MaintenanceRequest",
      entityId: id,
      changes: { status: RequestStatus.COMPLETED, completionApprovedAt: approvedAt },
      previousValues: { status: RequestStatus.PENDING_CONSULTANT_APPROVAL },
    });
    const updated = await this.populateRequest(id);
    const targetIds = await this.getDepartmentNotificationUserIds(
      request.departmentId.toString(),
      [Role.CONSULTANT, Role.ADMIN],
    );
    targetIds.push(request.engineerId.toString());
    this.notificationsGateway.notifyCompletionApproved(updated, targetIds);
    return updated;
  }

  async rejectCompletion(
    id: string,
    dto: RejectCompletionDto,
    user: { userId: string; name: string; role: string },
  ): Promise<MaintenanceRequestDocument> {
    const request = await this.requestModel.findOne({ _id: id, deletedAt: null });
    if (!request) throw new EntityNotFoundException("Maintenance Request", id);
    const departmentIds = await this.getUserDepartmentIds(user.userId);
    if (!departmentIds.includes(request.departmentId.toString())) {
      throw new ForbiddenAccessException("This request is outside your assigned departments");
    }
    const updatedRaw = await this.requestModel.findOneAndUpdate(
      { _id: id, status: RequestStatus.PENDING_CONSULTANT_APPROVAL },
      {
        status: RequestStatus.IN_PROGRESS,
        $unset: {
          completionRequestedAt: 1,
          completionRequestedBy: 1,
          closedAt: 1,
        },
        $push: {
          requestNotes: {
            body: `إعادة الإكمال للمهندس: ${dto.reason.trim()}`,
            authorId: new Types.ObjectId(user.userId),
            authorName: user.name,
            authorRole: user.role,
            createdAt: new Date(),
          },
        },
      },
      { new: true },
    );
    if (!updatedRaw) {
      throw new InvalidOperationException("Completion approval was already processed");
    }
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.STATUS_CHANGE,
      entity: "MaintenanceRequest",
      entityId: id,
      changes: { status: RequestStatus.IN_PROGRESS, rejectionReason: dto.reason.trim() },
      previousValues: { status: RequestStatus.PENDING_CONSULTANT_APPROVAL },
    });
    const updated = await this.populateRequest(id);
    this.notificationsGateway.notifyCompletionRejected(
      updated,
      [request.engineerId.toString()],
      dto.reason.trim(),
    );
    return updated;
  }

  private async generateRequestCode(
    maintenanceType: MaintenanceType,
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

  private async buildFilter(
    filterDto: FilterRequestsDto,
    user: { userId: string; role: string },
  ): Promise<FilterQuery<MaintenanceRequestDocument>> {
    const filter: FilterQuery<MaintenanceRequestDocument> = {
      deletedAt: null, // استبعاد المحذوفين ناعماً
    };

    // Engineers can only see their own requests (always apply engineerId filter)
    if (user.role === Role.ENGINEER) {
      // Support both String and ObjectId formats
      filter.engineerId = {
        $in: [
          user.userId,
          Types.ObjectId.isValid(user.userId)
            ? new Types.ObjectId(user.userId)
            : null,
        ].filter(Boolean),
      } as any;
    }

    // Consultants can only see requests from their departments.
    if (user.role === Role.CONSULTANT) {
      const departmentIds = await this.getUserDepartmentIds(user.userId);
      if (
        filterDto.departmentId &&
        !departmentIds.includes(filterDto.departmentId)
      ) {
        throw new ForbiddenAccessException(
          "Department is outside your assigned scope",
        );
      }
      filter.departmentId = filterDto.departmentId
        ? new Types.ObjectId(filterDto.departmentId)
        : { $in: departmentIds.map((id) => new Types.ObjectId(id)) } as any;
    }

    if (filterDto.openOnly) {
      filter.status = { $in: [...OPEN_REQUEST_STATUSES] } as any;
    } else if (filterDto.status) {
      filter.status = filterDto.status;
    }

    // Allow Admins and Consultants to filter by specific engineer
    if (filterDto.engineerId && user.role !== Role.ENGINEER) {
      // Support both String and ObjectId formats
      filter.engineerId = {
        $in: [
          filterDto.engineerId,
          Types.ObjectId.isValid(filterDto.engineerId)
            ? new Types.ObjectId(filterDto.engineerId)
            : null,
        ].filter(Boolean),
      } as any;
    }

    if (filterDto.consultantId) {
      // Support both String and ObjectId formats
      filter.consultantId = {
        $in: [
          filterDto.consultantId,
          Types.ObjectId.isValid(filterDto.consultantId)
            ? new Types.ObjectId(filterDto.consultantId)
            : null,
        ].filter(Boolean),
      } as any;
    }

    if (filterDto.locationId) {
      // Support both String and ObjectId formats
      filter.locationId = {
        $in: [
          filterDto.locationId,
          Types.ObjectId.isValid(filterDto.locationId)
            ? new Types.ObjectId(filterDto.locationId)
            : null,
        ].filter(Boolean),
      } as any;
    }

    // Consultant department filter is already validated and applied above.
    if (filterDto.departmentId && user.role !== Role.CONSULTANT) {
      // Support both String and ObjectId formats
      filter.departmentId = {
        $in: [
          filterDto.departmentId,
          Types.ObjectId.isValid(filterDto.departmentId)
            ? new Types.ObjectId(filterDto.departmentId)
            : null,
        ].filter(Boolean),
      } as any;
    }

    if (filterDto.systemId) {
      // Support both String and ObjectId formats
      filter.systemId = {
        $in: [
          filterDto.systemId,
          Types.ObjectId.isValid(filterDto.systemId)
            ? new Types.ObjectId(filterDto.systemId)
            : null,
        ].filter(Boolean),
      } as any;
    }

    if (filterDto.machineId) {
      // Support both String and ObjectId formats
      filter.machineId = {
        $in: [
          filterDto.machineId,
          Types.ObjectId.isValid(filterDto.machineId)
            ? new Types.ObjectId(filterDto.machineId)
            : null,
        ].filter(Boolean),
      } as any;
    }

    if (filterDto.maintenanceType) {
      filter.maintenanceType = filterDto.maintenanceType;
    }

    if (filterDto.openedBefore) {
      filter.openedAt = { $lt: new Date(filterDto.openedBefore) };
      if (!filterDto.status) {
        filter.status = {
          $in: [...OPEN_REQUEST_STATUSES],
        } as any;
      }
    }

    if (filterDto.fromDate || filterDto.toDate) {
      filter.createdAt = {};
      if (filterDto.fromDate) {
        filter.createdAt.$gte = new Date(filterDto.fromDate);
      }
      if (filterDto.toDate) {
        const toDate = new Date(filterDto.toDate);
        toDate.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = toDate;
      }
    }

    return filter;
  }

  private formatNoteWithAuthor(note: string, authorName: string): string {
    // إزالة أي اسم موجود مسبقاً في نهاية الملاحظة
    const cleanedNote = note.replace(/\s*\([^)]+\)\s*$/, "").trim();
    return `${cleanedNote} (${authorName})`;
  }

  private async populateRequest(
    id: string,
  ): Promise<MaintenanceRequestDocument> {
    return this.requestModel
      .findById(id)
      .populate("engineerId", "name email")
      .populate("consultantId", "name email")
      .populate("healthSafetySupervisorId", "name email")
      .populate("locationId", "name")
      .populate("floorId", "name")
      .populate("departmentId", "name")
      .populate("systemId", "name")
      .populate("machineId", "name components description")
      .populate("complaintId", "complaintCode reporterNameAr reporterNameEn")
      .populate("completionApprovedBy", "name email")
      .populate("deletedBy", "name email")
      .exec() as Promise<MaintenanceRequestDocument>;
  }

  private async getUserDepartmentIds(userId: string): Promise<string[]> {
    const user = await this.userModel
      .findById(userId)
      .select("departmentIds")
      .lean();
    return (user?.departmentIds || []).map((id) => id.toString());
  }

  private async getDepartmentNotificationUserIds(
    departmentId: string,
    roles: Role[],
  ): Promise<string[]> {
    const users = await this.userModel
      .find({
        role: { $in: roles },
        isActive: true,
        deletedAt: null,
        $or: [
          { role: { $in: [Role.ADMIN, Role.MAINTENANCE_MANAGER] } },
          { departmentIds: new Types.ObjectId(departmentId) },
        ],
      })
      .select("_id")
      .lean();
    return users.map((item) => item._id.toString());
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
    user: { userId: string; name: string },
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
    user: { userId: string; name: string },
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
    user: { userId: string; name: string },
  ): Promise<MaintenanceRequestDocument> {
    const request = await this.requestModel.findById(id);
    if (!request || !request.deletedAt) {
      throw new EntityNotFoundException("Maintenance Request", id);
    }

    const restored = await this.requestModel.findByIdAndUpdate(
      id,
      { $unset: { deletedAt: 1, deletedBy: 1 } },
      { new: true },
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
    filterDto: FilterRequestsDto,
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
          Types.ObjectId.isValid(filterDto.engineerId)
            ? new Types.ObjectId(filterDto.engineerId)
            : null,
        ].filter(Boolean),
      } as any;
    }

    if (filterDto.consultantId) {
      // Support both String and ObjectId formats
      filter.consultantId = {
        $in: [
          filterDto.consultantId,
          Types.ObjectId.isValid(filterDto.consultantId)
            ? new Types.ObjectId(filterDto.consultantId)
            : null,
        ].filter(Boolean),
      } as any;
    }

    if (filterDto.locationId) {
      // Support both String and ObjectId formats
      filter.locationId = {
        $in: [
          filterDto.locationId,
          Types.ObjectId.isValid(filterDto.locationId)
            ? new Types.ObjectId(filterDto.locationId)
            : null,
        ].filter(Boolean),
      } as any;
    }

    if (filterDto.departmentId) {
      // Support both String and ObjectId formats
      filter.departmentId = {
        $in: [
          filterDto.departmentId,
          Types.ObjectId.isValid(filterDto.departmentId)
            ? new Types.ObjectId(filterDto.departmentId)
            : null,
        ].filter(Boolean),
      } as any;
    }

    if (filterDto.systemId) {
      // Support both String and ObjectId formats
      filter.systemId = {
        $in: [
          filterDto.systemId,
          Types.ObjectId.isValid(filterDto.systemId)
            ? new Types.ObjectId(filterDto.systemId)
            : null,
        ].filter(Boolean),
      } as any;
    }

    if (filterDto.machineId) {
      // Support both String and ObjectId formats
      filter.machineId = {
        $in: [
          filterDto.machineId,
          Types.ObjectId.isValid(filterDto.machineId)
            ? new Types.ObjectId(filterDto.machineId)
            : null,
        ].filter(Boolean),
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
