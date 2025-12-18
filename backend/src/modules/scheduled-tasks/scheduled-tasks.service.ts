import { Injectable, Inject, forwardRef } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, FilterQuery, Types } from "mongoose";
import {
  ScheduledTask,
  ScheduledTaskDocument,
} from "./schemas/scheduled-task.schema";
import { Machine, MachineDocument } from "../machines/schemas/machine.schema";
import {
  CreateScheduledTaskDto,
  UpdateScheduledTaskDto,
  FilterScheduledTasksDto,
} from "./dto";
import {
  EntityNotFoundException,
  InvalidOperationException,
  ForbiddenAccessException,
} from "../../common/exceptions";
import { TaskStatus, Role, AuditAction } from "../../common/enums";
import {
  createPaginationMeta,
  getSkipAndLimit,
  getSortOptions,
  PaginatedResult,
} from "../../common/utils/pagination.util";
import { AuditLogsService } from "../audit-logs/audit-logs.service";

@Injectable()
export class ScheduledTasksService {
  constructor(
    @InjectModel(ScheduledTask.name)
    private taskModel: Model<ScheduledTaskDocument>,
    @InjectModel(Machine.name)
    private machineModel: Model<MachineDocument>,
    @Inject(forwardRef(() => AuditLogsService))
    private auditLogsService: AuditLogsService
  ) {}

  async create(
    createDto: CreateScheduledTaskDto,
    user: { userId: string; name: string }
  ): Promise<ScheduledTaskDocument> {
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

    // Generate task code
    const taskCode = await this.generateTaskCode();

    const task = new this.taskModel({
      ...createDto,
      engineerId: new Types.ObjectId(createDto.engineerId),
      locationId: new Types.ObjectId(createDto.locationId),
      departmentId: new Types.ObjectId(createDto.departmentId),
      systemId: new Types.ObjectId(createDto.systemId),
      machineId: new Types.ObjectId(createDto.machineId),
      maintainAllComponents,
      taskCode,
      status: TaskStatus.PENDING,
      createdBy: new Types.ObjectId(user.userId),
    });

    const saved = await task.save();
    const populated = await this.populateTask(saved._id.toString());

    if (!populated) {
      throw new EntityNotFoundException("Scheduled Task", saved._id.toString());
    }

    // Log the action
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.CREATE,
      entity: "ScheduledTask",
      entityId: saved._id.toString(),
      changes: { taskCode, title: createDto.title },
    });

    return populated;
  }

  async findAll(
    filterDto: FilterScheduledTasksDto,
    user: { userId: string; role: string }
  ): Promise<PaginatedResult<ScheduledTaskDocument>> {
    const filter = this.buildFilter(filterDto, user);
    const { skip, limit } = getSkipAndLimit(filterDto);
    const sortOptions = getSortOptions(filterDto);

    // Update overdue tasks
    await this.updateOverdueTasks();

    const [tasks, total] = await Promise.all([
      this.taskModel
        .find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .populate("engineerId", "name email")
        .populate("locationId", "name")
        .populate("departmentId", "name")
        .populate("systemId", "name")
        .populate("machineId", "name")
        .populate("createdBy", "name email")
        .populate("completedRequestId", "requestCode")
        .exec(),
      this.taskModel.countDocuments(filter),
    ]);

    const meta = createPaginationMeta(total, filterDto.page || 1, limit);

    return {
      data: tasks,
      meta,
    };
  }

  async findPendingByEngineer(
    engineerId: string
  ): Promise<ScheduledTaskDocument[]> {
    // Update overdue tasks first
    await this.updateOverdueTasks();

    const tasks = await this.taskModel
      .find({
        $or: [
          { engineerId: engineerId }, // Match string
          {
            engineerId: Types.ObjectId.isValid(engineerId)
              ? new Types.ObjectId(engineerId)
              : null,
          }, // Match ObjectId
        ],
        status: { $in: [TaskStatus.PENDING, TaskStatus.OVERDUE] },
      })
      .sort({ scheduledYear: 1, scheduledMonth: 1 })
      .populate("locationId", "name")
      .populate("departmentId", "name")
      .populate("systemId", "name")
      .populate("machineId", "name")
      .exec();

    return tasks;
  }

  async findMyTasks(
    engineerId: string,
    filterDto: FilterScheduledTasksDto
  ): Promise<PaginatedResult<ScheduledTaskDocument>> {
    // Build filter to match both ObjectId and string engineerId
    const filter: FilterQuery<ScheduledTaskDocument> = {
      $or: [
        { engineerId: engineerId }, // Match string
        {
          engineerId: Types.ObjectId.isValid(engineerId)
            ? new Types.ObjectId(engineerId)
            : null,
        }, // Match ObjectId
      ],
    };

    if (filterDto.status) {
      filter.status = filterDto.status;
    }

    // Update overdue tasks
    await this.updateOverdueTasks();

    const { skip, limit } = getSkipAndLimit(filterDto);
    const sortOptions = getSortOptions(filterDto);

    const [tasks, total] = await Promise.all([
      this.taskModel
        .find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .populate("locationId", "name")
        .populate("departmentId", "name")
        .populate("systemId", "name")
        .populate("machineId", "name")
        .populate("completedRequestId", "requestCode")
        .exec(),
      this.taskModel.countDocuments(filter),
    ]);

    const meta = createPaginationMeta(total, filterDto.page || 1, limit);

    return {
      data: tasks,
      meta,
    };
  }

  async findById(id: string): Promise<ScheduledTaskDocument> {
    const task = await this.populateTask(id);
    if (!task) {
      throw new EntityNotFoundException("Scheduled Task", id);
    }
    return task;
  }

  async update(
    id: string,
    updateDto: UpdateScheduledTaskDto,
    user: { userId: string; name: string }
  ): Promise<ScheduledTaskDocument> {
    const task = await this.taskModel.findById(id);
    if (!task) {
      throw new EntityNotFoundException("Scheduled Task", id);
    }

    // Validate components if maintainAllComponents is false
    if (
      updateDto.maintainAllComponents === false ||
      (updateDto.maintainAllComponents === undefined &&
        !task.maintainAllComponents)
    ) {
      const selectedComponents =
        updateDto.selectedComponents || task.selectedComponents || [];

      if (selectedComponents.length === 0) {
        throw new InvalidOperationException(
          "Selected components are required when maintainAllComponents is false"
        );
      }

      const machineId = updateDto.machineId || task.machineId.toString();
      const machine = await this.machineModel.findById(machineId);
      if (!machine) {
        throw new EntityNotFoundException("Machine", machineId);
      }

      const invalidComponents = selectedComponents.filter(
        (component) => !machine.components?.includes(component)
      );

      if (invalidComponents.length > 0) {
        throw new InvalidOperationException(
          `The following components are not valid for this machine: ${invalidComponents.join(", ")}`
        );
      }
    }

    const previousValues = {
      title: task.title,
      status: task.status,
    };

    // Convert IDs to ObjectId if they exist in the update
    const updateData: any = { ...updateDto };
    if (updateDto.engineerId) {
      updateData.engineerId = new Types.ObjectId(updateDto.engineerId);
    }
    if (updateDto.locationId) {
      updateData.locationId = new Types.ObjectId(updateDto.locationId);
    }
    if (updateDto.departmentId) {
      updateData.departmentId = new Types.ObjectId(updateDto.departmentId);
    }
    if (updateDto.systemId) {
      updateData.systemId = new Types.ObjectId(updateDto.systemId);
    }
    if (updateDto.machineId) {
      updateData.machineId = new Types.ObjectId(updateDto.machineId);
    }

    await this.taskModel.findByIdAndUpdate(id, updateData);

    // Log the action
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.UPDATE,
      entity: "ScheduledTask",
      entityId: id,
      changes: updateDto as Record<string, unknown>,
      previousValues,
    });

    const populated = await this.populateTask(id);
    if (!populated) {
      throw new EntityNotFoundException("Scheduled Task", id);
    }
    return populated;
  }

  async delete(
    id: string,
    user: { userId: string; name: string }
  ): Promise<void> {
    const task = await this.taskModel.findById(id);
    if (!task) {
      throw new EntityNotFoundException("Scheduled Task", id);
    }

    await this.taskModel.findByIdAndDelete(id);

    // Log the action
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.DELETE,
      entity: "ScheduledTask",
      entityId: id,
      changes: { taskCode: task.taskCode, title: task.title },
    });
  }

  async markAsCompleted(
    taskId: string,
    requestId: string
  ): Promise<ScheduledTaskDocument> {
    const task = await this.taskModel.findById(taskId);
    if (!task) {
      throw new EntityNotFoundException("Scheduled Task", taskId);
    }

    await this.taskModel.findByIdAndUpdate(taskId, {
      status: TaskStatus.COMPLETED,
      completedRequestId: new Types.ObjectId(requestId),
      completedAt: new Date(),
    });

    const populated = await this.populateTask(taskId);
    if (!populated) {
      throw new EntityNotFoundException("Scheduled Task", taskId);
    }
    return populated;
  }

  async markAsPending(taskId: string): Promise<ScheduledTaskDocument> {
    const task = await this.taskModel.findById(taskId);
    if (!task) {
      throw new EntityNotFoundException("Scheduled Task", taskId);
    }

    await this.taskModel.findByIdAndUpdate(taskId, {
      status: TaskStatus.PENDING,
      completedRequestId: undefined,
      completedAt: undefined,
    });

    const populated = await this.populateTask(taskId);
    if (!populated) {
      throw new EntityNotFoundException("Scheduled Task", taskId);
    }
    return populated;
  }

  calculateDaysRemaining(
    scheduledMonth: number,
    scheduledYear: number,
    scheduledDay?: number
  ): number {
    const now = new Date();
    // Use scheduledDay if provided, otherwise use 1 (first day of month)
    const day = scheduledDay || 1;
    const targetDate = new Date(scheduledYear, scheduledMonth - 1, day);
    const diffTime = targetDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  async updateOverdueTasks(): Promise<void> {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Reset to start of day for accurate comparison
    
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    await this.taskModel.updateMany(
      {
        status: TaskStatus.PENDING,
        $or: [
          // Tasks from previous years
          { scheduledYear: { $lt: currentYear } },
          // Tasks from previous months in current year
          {
            scheduledYear: currentYear,
            scheduledMonth: { $lt: currentMonth },
          },
          // Tasks from current month but past days
          {
            scheduledYear: currentYear,
            scheduledMonth: currentMonth,
            scheduledDay: { $exists: true, $lt: currentDay },
          },
        ],
      },
      {
        $set: { status: TaskStatus.OVERDUE },
      }
    );
  }

  private async generateTaskCode(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");

    const prefix = "TASK";

    // Find the last task of this month
    const lastTask = await this.taskModel
      .findOne({
        taskCode: { $regex: `^${prefix}-${year}${month}` },
      })
      .sort({ taskCode: -1 });

    let sequence = 1;
    if (lastTask) {
      const lastSequence = parseInt(lastTask.taskCode.split("-")[2], 10);
      sequence = lastSequence + 1;
    }

    return `${prefix}-${year}${month}-${String(sequence).padStart(4, "0")}`;
  }

  private buildFilter(
    filterDto: FilterScheduledTasksDto,
    user: { userId: string; role: string }
  ): FilterQuery<ScheduledTaskDocument> {
    const filter: FilterQuery<ScheduledTaskDocument> = {};

    if (filterDto.status) {
      filter.status = filterDto.status;
    }

    if (filterDto.engineerId) {
      filter.engineerId = Types.ObjectId.isValid(filterDto.engineerId)
        ? new Types.ObjectId(filterDto.engineerId)
        : filterDto.engineerId;
    }

    if (filterDto.locationId) {
      filter.locationId = Types.ObjectId.isValid(filterDto.locationId)
        ? new Types.ObjectId(filterDto.locationId)
        : filterDto.locationId;
    }

    if (filterDto.departmentId) {
      filter.departmentId = Types.ObjectId.isValid(filterDto.departmentId)
        ? new Types.ObjectId(filterDto.departmentId)
        : filterDto.departmentId;
    }

    if (filterDto.systemId) {
      filter.systemId = Types.ObjectId.isValid(filterDto.systemId)
        ? new Types.ObjectId(filterDto.systemId)
        : filterDto.systemId;
    }

    if (filterDto.machineId) {
      filter.machineId = Types.ObjectId.isValid(filterDto.machineId)
        ? new Types.ObjectId(filterDto.machineId)
        : filterDto.machineId;
    }

    if (filterDto.taskType) {
      filter.taskType = filterDto.taskType;
    }

    if (filterDto.scheduledMonth) {
      filter.scheduledMonth = filterDto.scheduledMonth;
    }

    if (filterDto.scheduledYear) {
      filter.scheduledYear = filterDto.scheduledYear;
    }

    return filter;
  }

  private async populateTask(
    id: string
  ): Promise<ScheduledTaskDocument | null> {
    return this.taskModel
      .findById(id)
      .populate("engineerId", "name email")
      .populate("locationId", "name")
      .populate("departmentId", "name")
      .populate("systemId", "name")
      .populate("machineId", "name")
      .populate("createdBy", "name email")
      .populate("completedRequestId", "requestCode")
      .exec();
  }
}
