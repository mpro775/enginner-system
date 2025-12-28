import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ScheduledTasksService } from "./scheduled-tasks.service";
import {
  CreateScheduledTaskDto,
  UpdateScheduledTaskDto,
  FilterScheduledTasksDto,
  AcceptTaskDto,
} from "./dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import {
  CurrentUser,
  CurrentUserData,
} from "../../common/decorators/current-user.decorator";
import { Role } from "../../common/enums";

@Controller("scheduled-tasks")
@UseGuards(JwtAuthGuard)
export class ScheduledTasksController {
  constructor(
    private readonly scheduledTasksService: ScheduledTasksService
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createDto: CreateScheduledTaskDto,
    @CurrentUser() user: CurrentUserData
  ) {
    const task = await this.scheduledTasksService.create(createDto, {
      userId: user.userId,
      name: user.name,
    });
    return {
      data: task,
      message: "Scheduled task created successfully",
    };
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async findAll(@Query() filterDto: FilterScheduledTasksDto, @CurrentUser() user: CurrentUserData) {
    const result = await this.scheduledTasksService.findAll(filterDto, {
      userId: user.userId,
      role: user.role,
    });
    return {
      data: result.data,
      meta: result.meta,
      message: "Scheduled tasks retrieved successfully",
    };
  }

  @Get("pending")
  @UseGuards(RolesGuard)
  @Roles(Role.ENGINEER)
  async findPending(@CurrentUser() user: CurrentUserData) {
    const tasks = await this.scheduledTasksService.findPendingByEngineer(
      user.userId
    );
    return {
      data: tasks,
      message: "Pending scheduled tasks retrieved successfully",
    };
  }

  @Get("available")
  @UseGuards(RolesGuard)
  @Roles(Role.ENGINEER)
  async getAvailableTasks() {
    const tasks = await this.scheduledTasksService.getAvailableTasks();
    return {
      data: tasks,
      message: "Available scheduled tasks retrieved successfully",
    };
  }

  @Post(":id/accept")
  @UseGuards(RolesGuard)
  @Roles(Role.ENGINEER)
  @HttpCode(HttpStatus.OK)
  async acceptTask(
    @Param("id") id: string,
    @Body() acceptDto: AcceptTaskDto,
    @CurrentUser() user: CurrentUserData
  ) {
    const task = await this.scheduledTasksService.acceptTask(id, user.userId, {
      userId: user.userId,
      name: user.name,
    });
    return {
      data: task,
      message: "Task accepted successfully",
    };
  }

  @Get("my-tasks")
  @UseGuards(RolesGuard)
  @Roles(Role.ENGINEER)
  async findMyTasks(
    @Query() filterDto: FilterScheduledTasksDto,
    @CurrentUser() user: CurrentUserData
  ) {
    const result = await this.scheduledTasksService.findMyTasks(
      user.userId,
      filterDto
    );
    return {
      data: result.data,
      meta: result.meta,
      message: "My scheduled tasks retrieved successfully",
    };
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    const task = await this.scheduledTasksService.findById(id);
    return {
      data: task,
      message: "Scheduled task retrieved successfully",
    };
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async update(
    @Param("id") id: string,
    @Body() updateDto: UpdateScheduledTaskDto,
    @CurrentUser() user: CurrentUserData
  ) {
    const task = await this.scheduledTasksService.update(id, updateDto, {
      userId: user.userId,
      name: user.name,
    });
    return {
      data: task,
      message: "Scheduled task updated successfully",
    };
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    await this.scheduledTasksService.delete(id, {
      userId: user.userId,
      name: user.name,
    });
    return {
      data: null,
      message: "Scheduled task deleted successfully",
    };
  }
}
