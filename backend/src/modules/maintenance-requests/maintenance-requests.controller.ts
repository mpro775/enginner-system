import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { MaintenanceRequestsService } from "./maintenance-requests.service";
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
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import {
  CurrentUser,
  CurrentUserData,
} from "../../common/decorators/current-user.decorator";
import { Role } from "../../common/enums";

@Controller("requests")
@UseGuards(JwtAuthGuard)
export class MaintenanceRequestsController {
  constructor(
    private readonly maintenanceRequestsService: MaintenanceRequestsService
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ENGINEER)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createDto: CreateMaintenanceRequestDto,
    @CurrentUser() user: CurrentUserData
  ) {
    const request = await this.maintenanceRequestsService.create(createDto, {
      userId: user.userId,
      name: user.name,
    });
    return {
      data: request,
      message: "Maintenance request created successfully",
    };
  }

  @Get()
  async findAll(
    @Query() filterDto: FilterRequestsDto,
    @CurrentUser() user: CurrentUserData
  ) {
    const result = await this.maintenanceRequestsService.findAll(filterDto, {
      userId: user.userId,
      role: user.role,
    });
    return {
      data: result.data,
      meta: result.meta,
      message: "Maintenance requests retrieved successfully",
    };
  }

  @Get("trash")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async findDeleted(@Query() filterDto: FilterRequestsDto) {
    const result = await this.maintenanceRequestsService.findDeleted(filterDto);
    return {
      data: result.data,
      meta: result.meta,
      message: "Deleted maintenance requests retrieved successfully",
    };
  }

  @Get(":id")
  async findOne(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    const request = await this.maintenanceRequestsService.findOne(id, {
      userId: user.userId,
      role: user.role,
    });
    return {
      data: request,
      message: "Maintenance request retrieved successfully",
    };
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.ENGINEER)
  async update(
    @Param("id") id: string,
    @Body() updateDto: UpdateMaintenanceRequestDto,
    @CurrentUser() user: CurrentUserData
  ) {
    const request = await this.maintenanceRequestsService.update(
      id,
      updateDto,
      {
        userId: user.userId,
        name: user.name,
        role: user.role,
      }
    );
    return {
      data: request,
      message: "Maintenance request updated successfully",
    };
  }

  @Patch(":id/stop")
  @UseGuards(RolesGuard)
  @Roles(Role.ENGINEER)
  async stop(
    @Param("id") id: string,
    @Body() stopDto: StopRequestDto,
    @CurrentUser() user: CurrentUserData
  ) {
    const request = await this.maintenanceRequestsService.stop(id, stopDto, {
      userId: user.userId,
      name: user.name,
    });
    return {
      data: request,
      message: "Maintenance request stopped successfully",
    };
  }

  @Patch(":id/note")
  @UseGuards(RolesGuard)
  @Roles(Role.CONSULTANT, Role.MAINTENANCE_MANAGER, Role.ADMIN)
  async addNote(
    @Param("id") id: string,
    @Body() noteDto: AddNoteDto,
    @CurrentUser() user: CurrentUserData
  ) {
    const request = await this.maintenanceRequestsService.addConsultantNote(
      id,
      noteDto,
      {
        userId: user.userId,
        name: user.name,
      }
    );
    return {
      data: request,
      message: "Note added successfully",
    };
  }

  @Patch(":id/health-safety-note")
  @UseGuards(RolesGuard)
  @Roles(Role.MAINTENANCE_SAFETY_MONITOR, Role.ADMIN)
  async addHealthSafetyNote(
    @Param("id") id: string,
    @Body() noteDto: AddHealthSafetyNoteDto,
    @CurrentUser() user: CurrentUserData
  ) {
    const request = await this.maintenanceRequestsService.addHealthSafetyNote(
      id,
      noteDto,
      {
        userId: user.userId,
        name: user.name,
      }
    );
    return {
      data: request,
      message: "Health safety note added successfully",
    };
  }

  @Patch(":id/project-manager-note")
  @UseGuards(RolesGuard)
  @Roles(Role.PROJECT_MANAGER, Role.ADMIN)
  async addProjectManagerNote(
    @Param("id") id: string,
    @Body() noteDto: AddProjectManagerNoteDto,
    @CurrentUser() user: CurrentUserData
  ) {
    const request = await this.maintenanceRequestsService.addProjectManagerNote(
      id,
      noteDto,
      {
        userId: user.userId,
        name: user.name,
      }
    );
    return {
      data: request,
      message: "Project manager note added successfully",
    };
  }

  @Patch(":id/complete")
  @UseGuards(RolesGuard)
  @Roles(Role.ENGINEER)
  async complete(
    @Param("id") id: string,
    @Body() completeDto: CompleteRequestDto,
    @CurrentUser() user: CurrentUserData
  ) {
    const request = await this.maintenanceRequestsService.complete(
      id,
      completeDto,
      {
        userId: user.userId,
        name: user.name,
      }
    );
    return {
      data: request,
      message: "Maintenance request completed successfully",
    };
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async softDelete(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    await this.maintenanceRequestsService.softDelete(id, {
      userId: user.userId,
      name: user.name,
    });
    return {
      data: null,
      message: "Maintenance request deleted successfully (soft delete)",
    };
  }

  @Delete(":id/hard")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async hardDelete(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    await this.maintenanceRequestsService.hardDelete(id, {
      userId: user.userId,
      name: user.name,
    });
    return {
      data: null,
      message: "Maintenance request permanently deleted",
    };
  }

  @Post(":id/restore")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async restore(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    const request = await this.maintenanceRequestsService.restore(id, {
      userId: user.userId,
      name: user.name,
    });
    return {
      data: request,
      message: "Maintenance request restored successfully",
    };
  }
}
