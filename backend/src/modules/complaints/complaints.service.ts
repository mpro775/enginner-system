import { Injectable, Inject, forwardRef } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, FilterQuery, Types } from "mongoose";
import {
  Complaint,
  ComplaintDocument,
} from "./schemas/complaint.schema";
import {
  CreateComplaintDto,
  UpdateComplaintDto,
  FilterComplaintsDto,
  AssignComplaintDto,
  LinkMaintenanceRequestDto,
  ChangeStatusDto,
} from "./dto";
import {
  EntityNotFoundException,
  ForbiddenAccessException,
} from "../../common/exceptions";
import {
  ComplaintStatus,
  Role,
  AuditAction,
} from "../../common/enums";
import {
  createPaginationMeta,
  getSkipAndLimit,
  getSortOptions,
  PaginatedResult,
} from "../../common/utils/pagination.util";
import { NotificationsGateway } from "../notifications/notifications.gateway";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { User, UserDocument } from "../users/schemas/user.schema";
import { MaintenanceRequest, MaintenanceRequestDocument } from "../maintenance-requests/schemas/maintenance-request.schema";

@Injectable()
export class ComplaintsService {
  constructor(
    @InjectModel(Complaint.name)
    private complaintModel: Model<ComplaintDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(MaintenanceRequest.name)
    private maintenanceRequestModel: Model<MaintenanceRequestDocument>,
    @Inject(forwardRef(() => NotificationsGateway))
    private notificationsGateway: NotificationsGateway,
    @Inject(forwardRef(() => AuditLogsService))
    private auditLogsService: AuditLogsService
  ) {}

  async create(
    createDto: CreateComplaintDto,
    user?: { userId: string; name: string }
  ): Promise<ComplaintDocument> {
    // Generate complaint code
    const complaintCode = await this.generateComplaintCode();

    const complaint = new this.complaintModel({
      ...createDto,
      complaintCode,
      status: ComplaintStatus.NEW,
    });

    const saved = await complaint.save();
    const populated = await this.populateComplaint(saved._id.toString());

    if (!populated) {
      throw new EntityNotFoundException("Complaint", saved._id.toString());
    }

    // Send real-time notification to all logged-in users
    this.notificationsGateway.notifyComplaintCreated(populated);

    // Log the action if user is provided (for authenticated users)
    if (user) {
      await this.auditLogsService.create({
        userId: user.userId,
        userName: user.name,
        action: AuditAction.CREATE,
        entity: "Complaint",
        entityId: saved._id.toString(),
        changes: {
          complaintCode,
          status: ComplaintStatus.NEW,
        },
      });
    }

    return populated;
  }

  async findAll(
    filterDto: FilterComplaintsDto,
    user: { userId: string; role: string }
  ): Promise<PaginatedResult<ComplaintDocument>> {
    const { skip, limit } = getSkipAndLimit(filterDto);
    const sortOptions = getSortOptions(filterDto);

    const filter = this.buildFilter(filterDto, user);

    const [complaints, total] = await Promise.all([
      this.complaintModel
        .find(filter)
        .populate("assignedEngineerId", "name email")
        .populate("maintenanceRequestId", "requestCode status")
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.complaintModel.countDocuments(filter),
    ]);

    return {
      data: complaints,
      meta: createPaginationMeta(total, filterDto.page || 1, limit),
    };
  }

  async findOne(
    id: string,
    user: { userId: string; role: string }
  ): Promise<ComplaintDocument> {
    const complaint = await this.populateComplaint(id);

    if (!complaint) {
      throw new EntityNotFoundException("Complaint", id);
    }

    // All authenticated users can view complaints
    return complaint;
  }

  async update(
    id: string,
    updateDto: UpdateComplaintDto,
    user: { userId: string; name: string; role: string }
  ): Promise<ComplaintDocument> {
    const complaint = await this.complaintModel.findById(id);

    if (!complaint) {
      throw new EntityNotFoundException("Complaint", id);
    }

    // Only ENGINEER and ADMIN can update
    if (user.role !== Role.ENGINEER && user.role !== Role.ADMIN) {
      throw new ForbiddenAccessException(
        "Only engineers and admins can update complaints"
      );
    }

    // Check ownership: if assigned, only assigned engineer or admin can update
    if (
      complaint.assignedEngineerId &&
      user.role !== Role.ADMIN &&
      complaint.assignedEngineerId.toString() !== user.userId
    ) {
      throw new ForbiddenAccessException(
        "Only the assigned engineer can update this complaint"
      );
    }

    const previousValues = {
      reporterName: complaint.reporterName,
      location: complaint.location,
      description: complaint.description,
      notes: complaint.notes,
    };

    await this.complaintModel.findByIdAndUpdate(id, updateDto);
    const updated = await this.populateComplaint(id);

    if (!updated) {
      throw new EntityNotFoundException("Complaint", id);
    }

    // Log the action
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.UPDATE,
      entity: "Complaint",
      entityId: id,
      changes: updateDto as Record<string, unknown>,
      previousValues,
    });

    return updated;
  }

  async assign(
    id: string,
    assignDto: AssignComplaintDto,
    user: { userId: string; name: string; role: string }
  ): Promise<ComplaintDocument> {
    const complaint = await this.complaintModel.findById(id);

    if (!complaint) {
      throw new EntityNotFoundException("Complaint", id);
    }

    // Only ENGINEER and ADMIN can assign
    if (user.role !== Role.ENGINEER && user.role !== Role.ADMIN) {
      throw new ForbiddenAccessException(
        "Only engineers and admins can assign complaints"
      );
    }

    // Verify engineer exists
    const engineer = await this.userModel.findById(assignDto.engineerId);
    if (!engineer) {
      throw new EntityNotFoundException("User", assignDto.engineerId);
    }

    // Verify engineer role
    if (engineer.role !== Role.ENGINEER) {
      throw new ForbiddenAccessException(
        "Assigned user must be an engineer"
      );
    }

    // Check ownership: if already assigned, only assigned engineer or admin can reassign
    if (
      complaint.assignedEngineerId &&
      user.role !== Role.ADMIN &&
      complaint.assignedEngineerId.toString() !== user.userId
    ) {
      throw new ForbiddenAccessException(
        "Only the assigned engineer can reassign this complaint"
      );
    }

    const previousEngineerId = complaint.assignedEngineerId?.toString();

    await this.complaintModel.findByIdAndUpdate(id, {
      assignedEngineerId: assignDto.engineerId,
      status: ComplaintStatus.IN_PROGRESS,
    });

    const updated = await this.populateComplaint(id);

    if (!updated) {
      throw new EntityNotFoundException("Complaint", id);
    }

    // Log the action
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.UPDATE,
      entity: "Complaint",
      entityId: id,
      changes: {
        assignedEngineerId: assignDto.engineerId,
        status: ComplaintStatus.IN_PROGRESS,
      },
      previousValues: {
        assignedEngineerId: previousEngineerId,
        status: complaint.status,
      },
    });

    return updated;
  }

  async linkMaintenanceRequest(
    id: string,
    linkDto: LinkMaintenanceRequestDto,
    user: { userId: string; name: string; role: string }
  ): Promise<ComplaintDocument> {
    const complaint = await this.complaintModel.findById(id);

    if (!complaint) {
      throw new EntityNotFoundException("Complaint", id);
    }

    // Only ENGINEER and ADMIN can link
    if (user.role !== Role.ENGINEER && user.role !== Role.ADMIN) {
      throw new ForbiddenAccessException(
        "Only engineers and admins can link maintenance requests"
      );
    }

    // Check ownership: if assigned, only assigned engineer or admin can link
    if (
      complaint.assignedEngineerId &&
      user.role !== Role.ADMIN &&
      complaint.assignedEngineerId.toString() !== user.userId
    ) {
      throw new ForbiddenAccessException(
        "Only the assigned engineer can link maintenance requests to this complaint"
      );
    }

    // Verify maintenance request exists
    const maintenanceRequest = await this.maintenanceRequestModel.findById(
      linkDto.maintenanceRequestId
    );
    if (!maintenanceRequest) {
      throw new EntityNotFoundException(
        "Maintenance Request",
        linkDto.maintenanceRequestId
      );
    }

    const previousRequestId = complaint.maintenanceRequestId?.toString();

    // Update complaint
    await this.complaintModel.findByIdAndUpdate(id, {
      maintenanceRequestId: linkDto.maintenanceRequestId,
    });

    // Update maintenance request to link back to complaint
    await this.maintenanceRequestModel.findByIdAndUpdate(
      linkDto.maintenanceRequestId,
      {
        complaintId: id,
      }
    );

    const updated = await this.populateComplaint(id);

    if (!updated) {
      throw new EntityNotFoundException("Complaint", id);
    }

    // Log the action
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.UPDATE,
      entity: "Complaint",
      entityId: id,
      changes: {
        maintenanceRequestId: linkDto.maintenanceRequestId,
      },
      previousValues: {
        maintenanceRequestId: previousRequestId,
      },
    });

    return updated;
  }

  async changeStatus(
    id: string,
    statusDto: ChangeStatusDto,
    user: { userId: string; name: string; role: string }
  ): Promise<ComplaintDocument> {
    const complaint = await this.complaintModel.findById(id);

    if (!complaint) {
      throw new EntityNotFoundException("Complaint", id);
    }

    // Only ENGINEER and ADMIN can change status
    if (user.role !== Role.ENGINEER && user.role !== Role.ADMIN) {
      throw new ForbiddenAccessException(
        "Only engineers and admins can change complaint status"
      );
    }

    // Check ownership: if assigned, only assigned engineer or admin can change status
    if (
      complaint.assignedEngineerId &&
      user.role !== Role.ADMIN &&
      complaint.assignedEngineerId.toString() !== user.userId
    ) {
      throw new ForbiddenAccessException(
        "Only the assigned engineer can change the status of this complaint"
      );
    }

    const previousStatus = complaint.status;
    const updateData: any = { status: statusDto.status };

    // Set resolvedAt or closedAt based on status
    if (statusDto.status === ComplaintStatus.RESOLVED) {
      updateData.resolvedAt = new Date();
    } else if (statusDto.status === ComplaintStatus.CLOSED) {
      updateData.closedAt = new Date();
    }

    await this.complaintModel.findByIdAndUpdate(id, updateData);
    const updated = await this.populateComplaint(id);

    if (!updated) {
      throw new EntityNotFoundException("Complaint", id);
    }

    // Send notification if resolved
    if (statusDto.status === ComplaintStatus.RESOLVED) {
      this.notificationsGateway.notifyComplaintResolved(updated);
    }

    // Log the action
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.STATUS_CHANGE,
      entity: "Complaint",
      entityId: id,
      changes: {
        status: statusDto.status,
      },
      previousValues: {
        status: previousStatus,
      },
    });

    return updated;
  }

  private async populateComplaint(
    id: string
  ): Promise<ComplaintDocument | null> {
    return this.complaintModel
      .findById(id)
      .populate("assignedEngineerId", "name email role")
      .populate("maintenanceRequestId", "requestCode status maintenanceType")
      .exec();
  }

  private buildFilter(
    filterDto: FilterComplaintsDto,
    user: { userId: string; role: string }
  ): FilterQuery<ComplaintDocument> {
    const filter: FilterQuery<ComplaintDocument> = {};

    // Status filter
    if (filterDto.status) {
      filter.status = filterDto.status;
    }

    // Assigned engineer filter
    if (filterDto.assignedEngineerId) {
      filter.assignedEngineerId = filterDto.assignedEngineerId;
    }

    // Search filter
    if (filterDto.search) {
      filter.$or = [
        { complaintCode: { $regex: filterDto.search, $options: "i" } },
        { reporterName: { $regex: filterDto.search, $options: "i" } },
        { location: { $regex: filterDto.search, $options: "i" } },
        { description: { $regex: filterDto.search, $options: "i" } },
      ];
    }

    // All authenticated users can see all complaints
    // No role-based filtering needed

    return filter;
  }

  private async generateComplaintCode(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();

    const prefix = "CMP";

    // Find the last complaint of this year
    const lastComplaint = await this.complaintModel
      .findOne({
        complaintCode: { $regex: `^${prefix}-${year}` },
      })
      .sort({ complaintCode: -1 });

    let sequence = 1;
    if (lastComplaint) {
      const lastSequence = parseInt(
        lastComplaint.complaintCode.split("-")[2],
        10
      );
      sequence = lastSequence + 1;
    }

    return `${prefix}-${year}-${String(sequence).padStart(3, "0")}`;
  }
}

