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
  AddHealthSafetyNoteDto,
  AddProjectManagerNoteDto,
  FilterRequestsDto,
  CompleteRequestDto,
  AddRequestNoteDto,
  RejectCompletionDto,
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
    const result = await this.maintenanceRequestsService.findAll(filterDto, user);
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
    const request = await this.maintenanceRequestsService.findOne(id, user);
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

  @Patch(":id/submit-completion")
  @UseGuards(RolesGuard)
  @Roles(Role.ENGINEER)
  async submitCompletion(
    @Param("id") id: string,
    @Body() completeDto: CompleteRequestDto,
    @CurrentUser() user: CurrentUserData
  ) {
    const request = await this.maintenanceRequestsService.submitCompletion(
      id,
      completeDto,
      {
        userId: user.userId,
        name: user.name,
      }
    );
    return {
      data: request,
      message: "Completion submitted for consultant approval",
    };
  }

  @Post(":id/notes")
  @UseGuards(RolesGuard)
  @Roles(
    Role.ENGINEER,
    Role.CONSULTANT,
    Role.MAINTENANCE_MANAGER,
    Role.ADMIN,
  )
  async addRequestNote(
    @Param("id") id: string,
    @Body() noteDto: AddRequestNoteDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return {
      data: await this.maintenanceRequestsService.addRequestNote(id, noteDto, user),
      message: "Request note added successfully",
    };
  }

  @Patch(":id/approve-completion")
  @UseGuards(RolesGuard)
  @Roles(Role.CONSULTANT)
  async approveCompletion(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return {
      data: await this.maintenanceRequestsService.approveCompletion(id, user),
      message: "Completion approved successfully",
    };
  }

  @Patch(":id/reject-completion")
  @UseGuards(RolesGuard)
  @Roles(Role.CONSULTANT)
  async rejectCompletion(
    @Param("id") id: string,
    @Body() dto: RejectCompletionDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return {
      data: await this.maintenanceRequestsService.rejectCompletion(id, dto, user),
      message: "Completion returned to engineer",
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
