import { Inject, Injectable, forwardRef } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FilterQuery, Model, Types } from "mongoose";
import { Complaint, ComplaintDocument } from "./schemas/complaint.schema";
import {
  AddReviewNoteDto,
  AssignComplaintDto,
  ChangeStatusDto,
  CreateComplaintDto,
  CreateComplaintMaintenanceRequestDto,
  FilterComplaintsDto,
  TransferDepartmentDto,
} from "./dto";
import {
  EntityNotFoundException,
  ForbiddenAccessException,
  InvalidOperationException,
} from "../../common/exceptions";
import {
  AuditAction,
  ComplaintStatus,
  ComplaintSubmissionLanguage,
  MaintenanceType,
  RequestStatus,
  Role,
} from "../../common/enums";
import {
  PaginatedResult,
  createPaginationMeta,
  getSkipAndLimit,
  getSortOptions,
} from "../../common/utils/pagination.util";
import { NotificationsGateway } from "../notifications/notifications.gateway";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { User, UserDocument } from "../users/schemas/user.schema";
import {
  MaintenanceRequest,
  MaintenanceRequestDocument,
} from "../maintenance-requests/schemas/maintenance-request.schema";
import { Location, LocationDocument } from "../locations/schemas/location.schema";
import { Floor, FloorDocument } from "../floors/schemas/floor.schema";
import {
  Department,
  DepartmentDocument,
} from "../departments/schemas/department.schema";
import { System, SystemDocument } from "../systems/schemas/system.schema";
import { Machine, MachineDocument } from "../machines/schemas/machine.schema";
import {
  AccessScopedUser,
  assertDepartmentAccess,
  getDepartmentMatchValues,
} from "../../common/utils/access-scope.util";

type ComplaintUser = AccessScopedUser & { name?: string };
type NormalizedComplaintPayload = Partial<Pick<
  CreateComplaintDto,
  | "submissionLanguage"
  | "reporterNameAr"
  | "reporterNameEn"
  | "locationAr"
  | "locationEn"
  | "descriptionAr"
  | "descriptionEn"
  | "notesAr"
  | "notesEn"
  | "detailedLocation"
  | "contactPhone"
>>;

const trimmedValue = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed || undefined;
};

export function normalizeComplaintPayload(
  createDto: Partial<CreateComplaintDto>,
): NormalizedComplaintPayload {
  const submissionLanguage =
    createDto.submissionLanguage ?? ComplaintSubmissionLanguage.BOTH;
  const normalized: NormalizedComplaintPayload = {
    submissionLanguage,
  };
  const detailedLocation = trimmedValue(createDto.detailedLocation);
  const contactPhone = trimmedValue(createDto.contactPhone);
  if (detailedLocation) normalized.detailedLocation = detailedLocation;
  if (contactPhone) normalized.contactPhone = contactPhone;
  if (
    submissionLanguage === ComplaintSubmissionLanguage.AR ||
    submissionLanguage === ComplaintSubmissionLanguage.BOTH
  ) {
    normalized.reporterNameAr = trimmedValue(createDto.reporterNameAr);
    normalized.locationAr = trimmedValue(createDto.locationAr);
    normalized.descriptionAr = trimmedValue(createDto.descriptionAr);
    normalized.notesAr = trimmedValue(createDto.notesAr);
  }
  if (
    submissionLanguage === ComplaintSubmissionLanguage.EN ||
    submissionLanguage === ComplaintSubmissionLanguage.BOTH
  ) {
    normalized.reporterNameEn = trimmedValue(createDto.reporterNameEn);
    normalized.locationEn = trimmedValue(createDto.locationEn);
    normalized.descriptionEn = trimmedValue(createDto.descriptionEn);
    normalized.notesEn = trimmedValue(createDto.notesEn);
  }
  return normalized;
}

@Injectable()
export class ComplaintsService {
  constructor(
    @InjectModel(Complaint.name)
    private complaintModel: Model<ComplaintDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(MaintenanceRequest.name)
    private maintenanceRequestModel: Model<MaintenanceRequestDocument>,
    @InjectModel(Location.name)
    private locationModel: Model<LocationDocument>,
    @InjectModel(Floor.name)
    private floorModel: Model<FloorDocument>,
    @InjectModel(Department.name)
    private departmentModel: Model<DepartmentDocument>,
    @InjectModel(System.name)
    private systemModel: Model<SystemDocument>,
    @InjectModel(Machine.name)
    private machineModel: Model<MachineDocument>,
    @Inject(forwardRef(() => NotificationsGateway))
    private notificationsGateway: NotificationsGateway,
    @Inject(forwardRef(() => AuditLogsService))
    private auditLogsService: AuditLogsService,
  ) {}

  async create(createDto: CreateComplaintDto): Promise<ComplaintDocument> {
    await this.validateComplaintReferences(createDto);
    let complaint: ComplaintDocument | null = null;
    for (let attempt = 0; attempt < 5 && !complaint; attempt += 1) {
      const complaintCode = await this.generateComplaintCode();
      try {
        complaint = await new this.complaintModel({
          ...normalizeComplaintPayload(createDto),
          locationId: new Types.ObjectId(createDto.locationId),
          floorId: new Types.ObjectId(createDto.floorId),
          departmentId: new Types.ObjectId(createDto.departmentId),
          complaintCode,
          status: ComplaintStatus.NEW,
        }).save();
      } catch (error: any) {
        const duplicateComplaintCode =
          error?.code === 11000 &&
          (error?.keyPattern?.complaintCode ||
            error?.keyValue?.complaintCode ||
            String(error?.message || "").includes("complaintCode"));
        if (duplicateComplaintCode) continue;
        throw error;
      }
    }
    if (!complaint) {
      throw new InvalidOperationException("Could not allocate a complaint code");
    }
    const populated = await this.requirePopulated(complaint._id.toString());
    const targetIds = await this.getDepartmentTargetUserIds(
      createDto.departmentId,
      [
        Role.ADMIN,
        Role.ENGINEER,
        Role.CONSULTANT,
        Role.MAINTENANCE_MANAGER,
      ],
    );
    this.notificationsGateway.notifyComplaintCreated(populated, targetIds);
    return populated;
  }

  async getPublicReferenceData() {
    const [locations, departments] = await Promise.all([
      this.locationModel
        .find({ isActive: true, deletedAt: null })
        .select("name")
        .sort({ name: 1 })
        .lean(),
      this.departmentModel
        .find({ isActive: true, deletedAt: null })
        .select("name")
        .sort({ name: 1 })
        .lean(),
    ]);
    return {
      locations: locations.map((item) => ({ id: item._id.toString(), name: item.name })),
      departments: departments.map((item) => ({ id: item._id.toString(), name: item.name })),
    };
  }

  async getPublicFloors(locationId: string) {
    if (!Types.ObjectId.isValid(locationId)) return [];
    const location = await this.locationModel.exists({
      _id: locationId,
      isActive: true,
      deletedAt: null,
    });
    if (!location) return [];
    const floors = await this.floorModel
      .find({
        locationId: new Types.ObjectId(locationId),
        isActive: true,
        deletedAt: null,
      })
      .select("name")
      .sort({ name: 1 })
      .lean();
    return floors.map((item) => ({ id: item._id.toString(), name: item.name }));
  }

  async findAll(
    filterDto: FilterComplaintsDto,
    user: AccessScopedUser,
  ): Promise<PaginatedResult<ComplaintDocument>> {
    const { skip, limit } = getSkipAndLimit(filterDto);
    const filter = await this.buildFilter(filterDto, user);
    const [complaints, total] = await Promise.all([
      this.complaintModel
        .find(filter)
        .populate("assignedEngineerId", "name email role")
        .populate("maintenanceRequestId", "requestCode status maintenanceType")
        .populate("locationId", "name")
        .populate("floorId", "name")
        .populate("departmentId", "name")
        .sort(getSortOptions(filterDto))
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
    user: AccessScopedUser,
  ): Promise<ComplaintDocument> {
    const complaint = await this.requirePopulated(id);
    await this.assertAccess(complaint, user);
    return complaint;
  }

  async addReviewNote(
    id: string,
    dto: AddReviewNoteDto,
    user: ComplaintUser,
  ): Promise<ComplaintDocument> {
    const complaint = await this.requireComplaint(id);
    await this.assertAccess(complaint, user);
    await this.complaintModel.findByIdAndUpdate(id, {
      $push: {
        reviewNotes: {
          body: dto.body.trim(),
          authorId: new Types.ObjectId(user.userId),
          authorName: user.name || "",
          authorRole: user.role,
          createdAt: new Date(),
        },
      },
    });
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name || "",
      action: AuditAction.UPDATE,
      entity: "Complaint",
      entityId: id,
      changes: { reviewNoteAdded: true },
    });
    return this.requirePopulated(id);
  }

  async assign(
    id: string,
    dto: AssignComplaintDto,
    user: ComplaintUser,
  ): Promise<ComplaintDocument> {
    const complaint = await this.requireComplaint(id);
    await this.assertAccess(complaint, user);
    if (!complaint.departmentId) {
      throw new InvalidOperationException("Complaint has no assigned department");
    }
    const engineerId = user.role === Role.ENGINEER ? user.userId : dto.engineerId;
    if (user.role === Role.ENGINEER && dto.engineerId !== user.userId) {
      throw new ForbiddenAccessException("Engineers may only self-assign");
    }
    const engineer = await this.getValidEngineer(
      engineerId,
      complaint.departmentId.toString(),
    );
    const previousEngineerId = complaint.assignedEngineerId?.toString();
    await this.complaintModel.findByIdAndUpdate(id, {
      assignedEngineerId: engineer._id,
      status: ComplaintStatus.IN_PROGRESS,
    });
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name || "",
      action: AuditAction.UPDATE,
      entity: "Complaint",
      entityId: id,
      changes: { assignedEngineerId: engineer._id.toString(), status: ComplaintStatus.IN_PROGRESS },
      previousValues: { assignedEngineerId: previousEngineerId, status: complaint.status },
    });
    return this.requirePopulated(id);
  }

  async changeStatus(
    id: string,
    dto: ChangeStatusDto,
    user: ComplaintUser,
  ): Promise<ComplaintDocument> {
    const complaint = await this.requireComplaint(id);
    await this.assertAccess(complaint, user);
    const update: Record<string, unknown> = { status: dto.status };
    if (dto.status === ComplaintStatus.RESOLVED) update.resolvedAt = new Date();
    if (dto.status === ComplaintStatus.CLOSED) update.closedAt = new Date();
    await this.complaintModel.findByIdAndUpdate(id, update);
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name || "",
      action: AuditAction.STATUS_CHANGE,
      entity: "Complaint",
      entityId: id,
      changes: { status: dto.status },
      previousValues: { status: complaint.status },
    });
    const updated = await this.requirePopulated(id);
    if (dto.status === ComplaintStatus.RESOLVED) {
      const targetIds = await this.getDepartmentTargetUserIds(
        complaint.departmentId!.toString(),
        [Role.ADMIN, Role.ENGINEER, Role.CONSULTANT, Role.MAINTENANCE_MANAGER],
      );
      if (complaint.assignedEngineerId) {
        targetIds.push(complaint.assignedEngineerId.toString());
      }
      this.notificationsGateway.notifyComplaintResolved(updated, targetIds);
    }
    return updated;
  }

  async transferDepartment(
    id: string,
    dto: TransferDepartmentDto,
    user: ComplaintUser,
  ): Promise<ComplaintDocument> {
    const complaint = await this.requireComplaint(id);
    await this.assertAccess(complaint, user);
    if (user.role === Role.ENGINEER || user.role === Role.CONSULTANT) {
      assertDepartmentAccess(user, dto.toDepartmentId);
    }
    if (complaint.maintenanceRequestId) {
      throw new InvalidOperationException(
        "A complaint linked to a maintenance request cannot be transferred independently",
      );
    }
    if (!complaint.departmentId) {
      throw new InvalidOperationException("Complaint has no assigned department");
    }
    if (complaint.departmentId.toString() === dto.toDepartmentId) {
      throw new InvalidOperationException("The target department must be different");
    }
    const [fromDepartment, toDepartment] = await Promise.all([
      this.departmentModel.findById(complaint.departmentId).lean(),
      this.departmentModel.findOne({
        _id: dto.toDepartmentId,
        isActive: true,
        deletedAt: null,
      }).lean(),
    ]);
    if (!toDepartment) throw new EntityNotFoundException("Department", dto.toDepartmentId);
    let removeAssignment = false;
    if (complaint.assignedEngineerId) {
      removeAssignment = !(await this.userModel.exists({
        _id: complaint.assignedEngineerId,
        role: Role.ENGINEER,
        isActive: true,
        deletedAt: null,
        departmentIds: new Types.ObjectId(dto.toDepartmentId),
      }));
    }
    const update: any = {
      departmentId: new Types.ObjectId(dto.toDepartmentId),
      $push: {
        departmentTransferHistory: {
          fromDepartmentId: complaint.departmentId,
          fromDepartmentName: fromDepartment?.name || "",
          toDepartmentId: toDepartment._id,
          toDepartmentName: toDepartment.name,
          transferredBy: new Types.ObjectId(user.userId),
          transferredByName: user.name || "",
          transferredByRole: user.role,
          transferredAt: new Date(),
          reason: trimmedValue(dto.reason),
        },
      },
    };
    if (removeAssignment) {
      update.$unset = { assignedEngineerId: 1 };
      if (complaint.status === ComplaintStatus.IN_PROGRESS) update.status = ComplaintStatus.NEW;
    }
    await this.complaintModel.findByIdAndUpdate(id, update);
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name || "",
      action: AuditAction.UPDATE,
      entity: "Complaint",
      entityId: id,
      changes: { departmentId: dto.toDepartmentId, transferReason: dto.reason },
      previousValues: { departmentId: complaint.departmentId.toString() },
    });
    const updated = await this.requirePopulated(id);
    const targetIds = await this.getDepartmentTargetUserIds(dto.toDepartmentId, [
      Role.ADMIN,
      Role.ENGINEER,
      Role.CONSULTANT,
      Role.MAINTENANCE_MANAGER,
    ]);
    this.notificationsGateway.notifyComplaintTransferred(updated, targetIds);
    return updated;
  }

  async createMaintenanceRequest(
    id: string,
    dto: CreateComplaintMaintenanceRequestDto,
    user: ComplaintUser,
  ): Promise<ComplaintDocument> {
    const complaint = await this.requireComplaint(id);
    await this.assertAccess(complaint, user);
    if (complaint.maintenanceRequestId) {
      throw new InvalidOperationException("Complaint is already linked to a request");
    }
    if (!complaint.locationId || !complaint.floorId || !complaint.departmentId || !complaint.detailedLocation) {
      throw new InvalidOperationException(
        "Legacy complaint is missing the required structured location data",
      );
    }
    const engineerId =
      user.role === Role.ENGINEER
        ? user.userId
        : dto.engineerId || complaint.assignedEngineerId?.toString();
    if (!engineerId) throw new InvalidOperationException("An engineer must be selected");
    const engineer = await this.getValidEngineer(engineerId, complaint.departmentId.toString());
    const system = await this.systemModel.findOne({
      _id: dto.systemId,
      isActive: true,
      deletedAt: null,
      departmentIds: complaint.departmentId,
    });
    if (!system) throw new EntityNotFoundException("System", dto.systemId);
    const machine = await this.machineModel.findOne({
      _id: dto.machineId,
      systemId: system._id,
      isActive: true,
      deletedAt: null,
    });
    if (!machine) throw new EntityNotFoundException("Machine", dto.machineId);
    const maintainAllComponents = dto.maintainAllComponents ?? true;
    if (!maintainAllComponents) {
      if (!dto.selectedComponents?.length) {
        throw new InvalidOperationException("At least one component must be selected");
      }
      const invalid = dto.selectedComponents.filter(
        (component) => !machine.components?.includes(component),
      );
      if (invalid.length) {
        throw new InvalidOperationException(`Invalid machine components: ${invalid.join(", ")}`);
      }
    }

    let created: MaintenanceRequestDocument | null = null;
    for (let attempt = 0; attempt < 5 && !created; attempt += 1) {
      try {
        created = await new this.maintenanceRequestModel({
          requestCode: await this.generateRequestCode(dto.maintenanceType),
          engineerId: engineer._id,
          maintenanceType: dto.maintenanceType,
          locationId: complaint.locationId,
          floorId: complaint.floorId,
          detailedLocation: complaint.detailedLocation,
          departmentId: complaint.departmentId,
          systemId: system._id,
          machineId: machine._id,
          reasonText: this.getOriginalDescription(complaint),
          requestNeeds: trimmedValue(dto.requestNeeds),
          maintainAllComponents,
          selectedComponents: maintainAllComponents ? [] : dto.selectedComponents,
          complaintId: complaint._id,
          status: RequestStatus.IN_PROGRESS,
          openedAt: new Date(),
        }).save();
      } catch (error: any) {
        if (error?.code === 11000 && error?.keyPattern?.requestCode) continue;
        if (error?.code === 11000 && error?.keyPattern?.complaintId) {
          throw new InvalidOperationException("A request was already created for this complaint");
        }
        throw error;
      }
    }
    if (!created) throw new InvalidOperationException("Could not allocate a request code");
    const reviewerNoteText = (dto.reviewerNotes || dto.reviewNote)?.trim();
    const updatePayload: any = {
      $set: {
        maintenanceRequestId: created._id,
        assignedEngineerId: engineer._id,
        status: ComplaintStatus.IN_PROGRESS,
      },
    };
    if (reviewerNoteText) {
      updatePayload.$push = {
        reviewNotes: {
          body: reviewerNoteText,
          authorId: new Types.ObjectId(user.userId),
          authorName: user.name || "",
          authorRole: user.role,
          createdAt: new Date(),
        },
      };
    }

    const linked = await this.complaintModel.findOneAndUpdate(
      {
        _id: complaint._id,
        $or: [
          { maintenanceRequestId: { $exists: false } },
          { maintenanceRequestId: null },
        ],
      },
      updatePayload,
      { new: true },
    );
    if (!linked) {
      await this.maintenanceRequestModel.deleteOne({ _id: created._id });
      throw new InvalidOperationException("A request was already created for this complaint");
    }
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name || "",
      action: AuditAction.CREATE,
      entity: "MaintenanceRequest",
      entityId: created._id.toString(),
      changes: { complaintId: id, requestCode: created.requestCode },
    });
    const populatedRequest = await this.maintenanceRequestModel
      .findById(created._id)
      .populate("engineerId", "name email")
      .populate("locationId", "name")
      .populate("floorId", "name")
      .populate("departmentId", "name")
      .populate("systemId", "name")
      .populate("machineId", "name components description")
      .exec();
    if (populatedRequest) {
      const requestTargets = await this.getDepartmentTargetUserIds(
        complaint.departmentId.toString(),
        [Role.ADMIN, Role.CONSULTANT, Role.MAINTENANCE_MANAGER],
      );
      requestTargets.push(engineer._id.toString());
      this.notificationsGateway.notifyRequestCreated(populatedRequest, requestTargets);
    }
    return this.requirePopulated(id);
  }

  async softDelete(id: string, user: { userId: string; name: string }): Promise<void> {
    const complaint = await this.complaintModel.findOne({ _id: id, deletedAt: null });
    if (!complaint) throw new EntityNotFoundException("Complaint", id);
    await this.complaintModel.findByIdAndUpdate(id, {
      deletedAt: new Date(),
      deletedBy: user.userId,
    });
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.SOFT_DELETE,
      entity: "Complaint",
      entityId: id,
      changes: { complaintCode: complaint.complaintCode },
    });
  }

  async hardDelete(id: string, user: { userId: string; name: string }): Promise<void> {
    const complaint = await this.complaintModel.findById(id);
    if (!complaint) throw new EntityNotFoundException("Complaint", id);
    await this.complaintModel.findByIdAndDelete(id);
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.HARD_DELETE,
      entity: "Complaint",
      entityId: id,
      changes: { complaintCode: complaint.complaintCode },
    });
  }

  async restore(id: string, user: { userId: string; name: string }): Promise<ComplaintDocument> {
    const complaint = await this.complaintModel.findOne({ _id: id, deletedAt: { $ne: null } });
    if (!complaint) throw new EntityNotFoundException("Complaint", id);
    await this.complaintModel.findByIdAndUpdate(id, {
      $unset: { deletedAt: 1, deletedBy: 1 },
    });
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.RESTORE,
      entity: "Complaint",
      entityId: id,
      changes: { complaintCode: complaint.complaintCode },
    });
    return this.requirePopulated(id);
  }

  async findDeleted(
    filterDto: FilterComplaintsDto,
  ): Promise<PaginatedResult<ComplaintDocument>> {
    const { skip, limit } = getSkipAndLimit(filterDto);
    const filter: FilterQuery<ComplaintDocument> = { deletedAt: { $ne: null } };
    this.applyCommonFilters(filter, filterDto);
    const [data, total] = await Promise.all([
      this.complaintModel
        .find(filter)
        .populate("assignedEngineerId", "name email role")
        .populate("maintenanceRequestId", "requestCode status maintenanceType")
        .populate("locationId", "name")
        .populate("floorId", "name")
        .populate("departmentId", "name")
        .populate("deletedBy", "name email")
        .sort({ deletedAt: -1, ...getSortOptions(filterDto) })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.complaintModel.countDocuments(filter),
    ]);
    return { data, meta: createPaginationMeta(total, filterDto.page || 1, limit) };
  }

  private async buildFilter(
    dto: FilterComplaintsDto,
    user: AccessScopedUser,
  ): Promise<FilterQuery<ComplaintDocument>> {
    const filter: FilterQuery<ComplaintDocument> = { deletedAt: null };
    this.applyCommonFilters(filter, dto);
    if (user.role === Role.ENGINEER || user.role === Role.CONSULTANT) {
      if (dto.departmentId) assertDepartmentAccess(user, dto.departmentId);
      filter.departmentId = dto.departmentId
        ? new Types.ObjectId(dto.departmentId)
        : ({ $in: getDepartmentMatchValues(user) } as any);
    } else if (dto.departmentId) {
      filter.departmentId = new Types.ObjectId(dto.departmentId);
    }
    if (
      ![Role.ADMIN, Role.MAINTENANCE_MANAGER, Role.ENGINEER, Role.CONSULTANT].includes(
        user.role as Role,
      )
    ) {
      filter._id = { $in: [] } as any;
    }
    return filter;
  }

  private applyCommonFilters(
    filter: FilterQuery<ComplaintDocument>,
    dto: FilterComplaintsDto,
  ) {
    if (dto.status) filter.status = dto.status;
    if (dto.assignedEngineerId) filter.assignedEngineerId = dto.assignedEngineerId as any;
    if (dto.search) {
      filter.$or = [
        { complaintCode: { $regex: dto.search, $options: "i" } },
        { reporterNameAr: { $regex: dto.search, $options: "i" } },
        { reporterNameEn: { $regex: dto.search, $options: "i" } },
        { detailedLocation: { $regex: dto.search, $options: "i" } },
        { descriptionAr: { $regex: dto.search, $options: "i" } },
        { descriptionEn: { $regex: dto.search, $options: "i" } },
      ];
    }
  }

  private async assertAccess(
    complaint: ComplaintDocument,
    user: AccessScopedUser,
  ): Promise<void> {
    if (user.role === Role.ADMIN || user.role === Role.MAINTENANCE_MANAGER) return;
    if (user.role !== Role.ENGINEER && user.role !== Role.CONSULTANT) {
      throw new ForbiddenAccessException("You do not have access to complaints");
    }
    const rawDepartmentId =
      (complaint.departmentId as any)?._id ?? complaint.departmentId;
    assertDepartmentAccess(
      user,
      rawDepartmentId,
      "Complaint is outside your assigned departments",
    );
  }

  private async getDepartmentTargetUserIds(
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

  private async validateComplaintReferences(dto: CreateComplaintDto) {
    const locationId = new Types.ObjectId(dto.locationId);
    const floorId = new Types.ObjectId(dto.floorId);
    const departmentId = new Types.ObjectId(dto.departmentId);

    const [location, floor, department] = await Promise.all([
      this.locationModel.exists({
        _id: locationId,
        isActive: true,
        deletedAt: null,
      }),
      this.floorModel.exists({
        _id: floorId,
        locationId,
        isActive: true,
        deletedAt: null,
      }),
      this.departmentModel.exists({
        _id: departmentId,
        isActive: true,
        deletedAt: null,
      }),
    ]);

    if (!location) {
      throw new EntityNotFoundException("Location", dto.locationId);
    }
    if (!floor) {
      throw new InvalidOperationException("Floor does not belong to the selected location");
    }
    if (!department) {
      throw new EntityNotFoundException("Department", dto.departmentId);
    }
  }

  private async getValidEngineer(engineerId: string, departmentId: string) {
    const engineer = await this.userModel.findOne({
      _id: engineerId,
      role: Role.ENGINEER,
      isActive: true,
      deletedAt: null,
      departmentIds: new Types.ObjectId(departmentId),
    });
    if (!engineer) {
      throw new InvalidOperationException(
        "Engineer must be active and belong to the complaint department",
      );
    }
    return engineer;
  }

  private async requireComplaint(id: string): Promise<ComplaintDocument> {
    const complaint = await this.complaintModel.findOne({ _id: id, deletedAt: null });
    if (!complaint) throw new EntityNotFoundException("Complaint", id);
    return complaint;
  }

  private async requirePopulated(id: string): Promise<ComplaintDocument> {
    const complaint = await this.complaintModel
      .findOne({ _id: id, deletedAt: null })
      .populate("assignedEngineerId", "name email role")
      .populate("maintenanceRequestId", "requestCode status maintenanceType")
      .populate("locationId", "name")
      .populate("floorId", "name")
      .populate("departmentId", "name")
      .populate("deletedBy", "name email")
      .exec();
    if (!complaint) throw new EntityNotFoundException("Complaint", id);
    return complaint;
  }

  private getOriginalDescription(complaint: ComplaintDocument): string {
    return complaint.descriptionAr || complaint.descriptionEn || "بلاغ صيانة";
  }

  private async generateComplaintCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `CMP-${year}`;
    const last = await this.complaintModel
      .findOne({ complaintCode: { $regex: `^${prefix}-` } })
      .sort({ complaintCode: -1 })
      .lean();
    const sequence = last
      ? Number.parseInt(last.complaintCode.split("-")[2], 10) + 1
      : 1;
    return `${prefix}-${String(sequence).padStart(3, "0")}`;
  }

  private async generateRequestCode(maintenanceType: MaintenanceType): Promise<string> {
    const now = new Date();
    const prefix = maintenanceType === MaintenanceType.PREVENTIVE ? "PM" : "EM";
    const period = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const last = await this.maintenanceRequestModel
      .findOne({ requestCode: { $regex: `^${prefix}-${period}-` } })
      .sort({ requestCode: -1 })
      .lean();
    const sequence = last
      ? Number.parseInt(last.requestCode.split("-")[2], 10) + 1
      : 1;
    return `${prefix}-${period}-${String(sequence).padStart(4, "0")}`;
  }
}
