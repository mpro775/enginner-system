import { Injectable, Inject, forwardRef } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, FilterQuery, Types } from "mongoose";
import {
  ScheduledTask,
  ScheduledTaskDocument,
} from "./schemas/scheduled-task.schema";
import { Machine, MachineDocument } from "../machines/schemas/machine.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
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
import { TaskStatus, Role, AuditAction, RepetitionInterval } from "../../common/enums";
import {
  createPaginationMeta,
  getSkipAndLimit,
  getSortOptions,
  PaginatedResult,
} from "../../common/utils/pagination.util";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { NotificationsGateway } from "../notifications/notifications.gateway";

@Injectable()
export class ScheduledTasksService {
  constructor(
    @InjectModel(ScheduledTask.name)
    private taskModel: Model<ScheduledTaskDocument>,
    @InjectModel(Machine.name)
    private machineModel: Model<MachineDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @Inject(forwardRef(() => AuditLogsService))
    private auditLogsService: AuditLogsService,
    @Inject(forwardRef(() => NotificationsGateway))
    private notificationsGateway: NotificationsGateway
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

    const taskData: any = {
      ...createDto,
      locationId: new Types.ObjectId(createDto.locationId),
      departmentId: new Types.ObjectId(createDto.departmentId),
      systemId: new Types.ObjectId(createDto.systemId),
      machineId: new Types.ObjectId(createDto.machineId),
      maintainAllComponents,
      taskCode,
      status: TaskStatus.PENDING,
      createdBy: new Types.ObjectId(user.userId),
    };

    // Only set engineerId if provided
    if (createDto.engineerId) {
      taskData.engineerId = new Types.ObjectId(createDto.engineerId);
    }

    const task = new this.taskModel(taskData);

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

    // Send notification
    const isAvailableToAll = !createDto.engineerId;
    this.notificationsGateway.notifyScheduledTaskCreated(populated, isAvailableToAll);

    return populated;
  }

  async findAll(
    filterDto: FilterScheduledTasksDto,
    user: { userId: string; role: string }
  ): Promise<PaginatedResult<ScheduledTaskDocument>> {
    const filter = await this.buildFilter(filterDto, user);
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
        .populate("deletedBy", "name email")
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
          { engineerId: { $exists: false } }, // Unassigned tasks
          { engineerId: null }, // Unassigned tasks
        ],
        status: { $in: [TaskStatus.PENDING, TaskStatus.OVERDUE] },
        deletedAt: null, // استبعاد المحذوفين ناعماً
      })
      .sort({ scheduledYear: 1, scheduledMonth: 1 })
      .populate("engineerId", "name email")
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
    // Only include assigned tasks (exclude unassigned)
    const filter: FilterQuery<ScheduledTaskDocument> = {
      $or: [
        { engineerId: engineerId }, // Match string
        {
          engineerId: Types.ObjectId.isValid(engineerId)
            ? new Types.ObjectId(engineerId)
            : null,
        }, // Match ObjectId
      ],
      deletedAt: null, // استبعاد المحذوفين ناعماً
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
    if (updateDto.engineerId !== undefined) {
      if (updateDto.engineerId) {
        updateData.engineerId = new Types.ObjectId(updateDto.engineerId);
      } else {
        updateData.engineerId = null; // Allow unassigning
      }
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

    // Handle repetitionInterval
    if (updateDto.repetitionInterval !== undefined) {
      updateData.repetitionInterval = updateDto.repetitionInterval;
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

  async softDelete(
    id: string,
    user: { userId: string; name: string; role: string }
  ): Promise<void> {
    const task = await this.taskModel.findById(id);
    if (!task || task.deletedAt) {
      throw new EntityNotFoundException("Scheduled Task", id);
    }

    // Check if consultant is trying to delete a task they didn't create
    if (
      user.role === Role.CONSULTANT &&
      task.createdBy.toString() !== user.userId
    ) {
      throw new ForbiddenAccessException(
        "You can only delete tasks that you created"
      );
    }

    await this.taskModel.findByIdAndUpdate(id, {
      deletedAt: new Date(),
      deletedBy: user.userId,
    });

    // Log the action
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.SOFT_DELETE,
      entity: "ScheduledTask",
      entityId: id,
      changes: { taskCode: task.taskCode, title: task.title },
    });
  }

  async hardDelete(
    id: string,
    user: { userId: string; name: string; role: string }
  ): Promise<void> {
    const task = await this.taskModel.findById(id);
    if (!task) {
      throw new EntityNotFoundException("Scheduled Task", id);
    }

    // Only ADMIN can hard delete
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenAccessException(
        "Only admins can permanently delete tasks"
      );
    }

    await this.taskModel.findByIdAndDelete(id);

    // Log the action
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.HARD_DELETE,
      entity: "ScheduledTask",
      entityId: id,
      changes: { taskCode: task.taskCode, title: task.title },
    });
  }

  async restore(
    id: string,
    user: { userId: string; name: string }
  ): Promise<ScheduledTaskDocument> {
    const task = await this.taskModel.findById(id);
    if (!task || !task.deletedAt) {
      throw new EntityNotFoundException("Scheduled Task", id);
    }

    const restored = await this.taskModel.findByIdAndUpdate(
      id,
      { $unset: { deletedAt: 1, deletedBy: 1 } },
      { new: true }
    );

    if (!restored) {
      throw new EntityNotFoundException("Scheduled Task", id);
    }

    const populated = await this.populateTask(id);
    if (!populated) {
      throw new EntityNotFoundException("Scheduled Task", id);
    }

    // Log the action
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.RESTORE,
      entity: "ScheduledTask",
      entityId: id,
      changes: { taskCode: task.taskCode, title: task.title },
    });

    return populated;
  }

  async findDeleted(
    filterDto: FilterScheduledTasksDto
  ): Promise<PaginatedResult<ScheduledTaskDocument>> {
    const filter: FilterQuery<ScheduledTaskDocument> = {
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

    const { skip, limit } = getSkipAndLimit(filterDto);
    const sortOptions = getSortOptions(filterDto);

    const [tasks, total] = await Promise.all([
      this.taskModel
        .find(filter)
        .sort({ deletedAt: -1, ...sortOptions })
        .skip(skip)
        .limit(limit)
        .populate("engineerId", "name email")
        .populate("locationId", "name")
        .populate("departmentId", "name")
        .populate("systemId", "name")
        .populate("machineId", "name")
        .populate("createdBy", "name email")
        .populate("deletedBy", "name email")
        .populate("completedRequestId", "requestCode")
        .exec(),
      this.taskModel.countDocuments(filter),
    ]);

    return {
      data: tasks,
      meta: createPaginationMeta(total, filterDto.page || 1, limit),
    };
  }

  // Keep for backward compatibility
  async delete(
    id: string,
    user: { userId: string; name: string; role: string }
  ): Promise<void> {
    return this.softDelete(id, user);
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

  private async buildFilter(
    filterDto: FilterScheduledTasksDto,
    user: { userId: string; role: string }
  ): Promise<FilterQuery<ScheduledTaskDocument>> {
    const filter: FilterQuery<ScheduledTaskDocument> = {
      deletedAt: null, // استبعاد المحذوفين ناعماً
    };

    // Consultants can only see tasks from their departments
    if (user.role === Role.CONSULTANT) {
      const consultant = (await this.userModel
        .findById(user.userId)
        .select("departmentIds +departmentId")
        .lean()) as { departmentIds?: unknown[]; departmentId?: unknown } | null;
      const deptIds = Array.isArray(consultant?.departmentIds)
        ? consultant.departmentIds
        : consultant?.departmentId
          ? [consultant.departmentId]
          : [];
      if (deptIds.length > 0) {
        const inValues: (Types.ObjectId | string)[] = [];
        for (const id of deptIds) {
          if (!id) continue;
          const str = String(id);
          if (Types.ObjectId.isValid(str)) {
            inValues.push(str);
            inValues.push(new Types.ObjectId(str));
          }
        }
        if (inValues.length > 0) {
          filter.departmentId = { $in: inValues } as any;
        }
      }
    }

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

    if (filterDto.locationId) {
      // Support both String and ObjectId formats
      filter.locationId = { 
        $in: [
          filterDto.locationId,
          Types.ObjectId.isValid(filterDto.locationId) ? new Types.ObjectId(filterDto.locationId) : null
        ].filter(Boolean)
      } as any;
    }

    // Only allow manual departmentId filter for non-Consultants (Consultants are auto-filtered)
    if (filterDto.departmentId && user.role !== Role.CONSULTANT) {
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
      .populate("deletedBy", "name email")
      .populate("completedRequestId", "requestCode")
      .populate("parentTaskId", "taskCode title")
      .exec();
  }

  async getAvailableTasks(): Promise<ScheduledTaskDocument[]> {
    // Update overdue tasks first
    await this.updateOverdueTasks();

    const tasks = await this.taskModel
      .find({
        $or: [
          { engineerId: { $exists: false } },
          { engineerId: null },
        ],
        status: { $in: [TaskStatus.PENDING, TaskStatus.OVERDUE] },
        deletedAt: null, // استبعاد المحذوفين ناعماً
      })
      .sort({ scheduledYear: 1, scheduledMonth: 1, scheduledDay: 1 })
      .populate("locationId", "name")
      .populate("departmentId", "name")
      .populate("systemId", "name")
      .populate("machineId", "name")
      .populate("createdBy", "name email")
      .exec();

    return tasks;
  }

  async acceptTask(
    taskId: string,
    engineerId: string,
    user: { userId: string; name: string }
  ): Promise<ScheduledTaskDocument> {
    const task = await this.taskModel.findById(taskId);
    if (!task) {
      throw new EntityNotFoundException("Scheduled Task", taskId);
    }

    // Check if task is already assigned
    if (task.engineerId) {
      throw new InvalidOperationException(
        "This task has already been assigned to an engineer"
      );
    }


    // Assign the task to the engineer
    await this.taskModel.findByIdAndUpdate(taskId, {
      engineerId: new Types.ObjectId(engineerId),
    });

    // Log the action
    await this.auditLogsService.create({
      userId: user.userId,
      userName: user.name,
      action: AuditAction.UPDATE,
      entity: "ScheduledTask",
      entityId: taskId,
      changes: { engineerId, action: "accepted_task" },
      previousValues: { engineerId: null },
    });

    const populated = await this.populateTask(taskId);
    if (!populated) {
      throw new EntityNotFoundException("Scheduled Task", taskId);
    }
    return populated;
  }

  async generateRecurringTasks(): Promise<void> {
    const now = new Date();
    const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Find all tasks with repetition intervals that need first generation
    const tasksNeedingFirstGen = await this.taskModel.find({
      repetitionInterval: { $exists: true, $ne: null },
      parentTaskId: { $exists: false }, // Only original tasks, not generated ones
      deletedAt: null, // استبعاد المحذوفين ناعماً
      $or: [
        { lastGeneratedAt: { $exists: false } },
        { lastGeneratedAt: null },
      ],
    });

    for (const task of tasksNeedingFirstGen) {
      if (!task.repetitionInterval) continue;

      // Calculate next date based on repetition interval
      const nextDate = this.calculateNextDate(
        task.scheduledYear,
        task.scheduledMonth,
        task.scheduledDay || 1,
        task.repetitionInterval,
        task.lastGeneratedAt
      );

      // Only create if next date is today or in the past (for overdue generation)
      if (nextDate <= currentDate) {
        // Check if a task for this date already exists
        const existingTask = await this.taskModel.findOne({
          parentTaskId: task._id,
          scheduledYear: nextDate.getFullYear(),
          scheduledMonth: nextDate.getMonth() + 1,
          scheduledDay: nextDate.getDate(),
        });

        if (!existingTask) {
          // Generate task code
          const taskCode = await this.generateTaskCode();

          // Create new task instance - WITHOUT engineerId so it's available to all engineers
          const newTask = new this.taskModel({
            taskCode,
            title: task.title,
            // engineerId: undefined - المهام المتكررة متاحة لجميع المهندسين
            locationId: task.locationId,
            departmentId: task.departmentId,
            systemId: task.systemId,
            machineId: task.machineId,
            maintainAllComponents: task.maintainAllComponents,
            selectedComponents: task.selectedComponents,
            scheduledYear: nextDate.getFullYear(),
            scheduledMonth: nextDate.getMonth() + 1,
            scheduledDay: nextDate.getDate(),
            description: task.description,
            status: TaskStatus.PENDING,
            parentTaskId: task._id,
            createdBy: task.createdBy,
          });

          await newTask.save();

          // Update task's lastGeneratedAt
          await this.taskModel.findByIdAndUpdate(task._id, {
            lastGeneratedAt: now,
          });

          // Send notification - recurring tasks are always available to all engineers
          const populatedNewTask = await this.populateTask(newTask._id.toString());
          if (populatedNewTask) {
            this.notificationsGateway.notifyScheduledTaskCreated(populatedNewTask, true);
          }
        }
      }
    }

    // Also check for tasks that need periodic generation
    const tasksWithLastGen = await this.taskModel.find({
      repetitionInterval: { $exists: true, $ne: null },
      parentTaskId: { $exists: false }, // Only original tasks
      lastGeneratedAt: { $exists: true, $ne: null },
    });

    for (const task of tasksWithLastGen) {
      if (!task.repetitionInterval || !task.lastGeneratedAt) continue;

      const lastGenDate = new Date(task.lastGeneratedAt);
      const nextGenDate = this.calculateNextDate(
        lastGenDate.getFullYear(),
        lastGenDate.getMonth() + 1,
        lastGenDate.getDate(),
        task.repetitionInterval,
        task.lastGeneratedAt
      );

      // Generate if it's time
      if (nextGenDate <= currentDate) {
        const existingTask = await this.taskModel.findOne({
          parentTaskId: task._id,
          scheduledYear: nextGenDate.getFullYear(),
          scheduledMonth: nextGenDate.getMonth() + 1,
          scheduledDay: nextGenDate.getDate(),
        });

        if (!existingTask) {
          const taskCode = await this.generateTaskCode();

          // Create new task instance - WITHOUT engineerId so it's available to all engineers
          const newTask = new this.taskModel({
            taskCode,
            title: task.title,
            // engineerId: undefined - المهام المتكررة متاحة لجميع المهندسين
            locationId: task.locationId,
            departmentId: task.departmentId,
            systemId: task.systemId,
            machineId: task.machineId,
            maintainAllComponents: task.maintainAllComponents,
            selectedComponents: task.selectedComponents,
            scheduledYear: nextGenDate.getFullYear(),
            scheduledMonth: nextGenDate.getMonth() + 1,
            scheduledDay: nextGenDate.getDate(),
            description: task.description,
            status: TaskStatus.PENDING,
            parentTaskId: task._id,
            createdBy: task.createdBy,
          });

          await newTask.save();

          await this.taskModel.findByIdAndUpdate(task._id, {
            lastGeneratedAt: now,
          });

          // Send notification - recurring tasks are always available to all engineers
          const populatedNewTask = await this.populateTask(newTask._id.toString());
          if (populatedNewTask) {
            this.notificationsGateway.notifyScheduledTaskCreated(populatedNewTask, true);
          }
        }
      }
    }
  }

  private calculateNextDate(
    year: number,
    month: number,
    day: number,
    interval: RepetitionInterval,
    lastGeneratedAt?: Date
  ): Date {
    const baseDate = lastGeneratedAt
      ? new Date(lastGeneratedAt)
      : new Date(year, month - 1, day);

    const nextDate = new Date(baseDate);

    switch (interval) {
      case RepetitionInterval.WEEKLY:
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case RepetitionInterval.MONTHLY:
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case RepetitionInterval.QUARTERLY:
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case RepetitionInterval.SEMI_ANNUALLY:
        nextDate.setMonth(nextDate.getMonth() + 6);
        break;
      default:
        return baseDate;
    }

    return nextDate;
  }
}
