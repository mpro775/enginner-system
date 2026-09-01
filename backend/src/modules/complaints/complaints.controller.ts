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
import { ComplaintsService } from "./complaints.service";
import {
  CreateComplaintDto,
  FilterComplaintsDto,
  AssignComplaintDto,
  ChangeStatusDto,
  AddReviewNoteDto,
  TransferDepartmentDto,
  CreateComplaintMaintenanceRequestDto,
} from "./dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import {
  CurrentUser,
  CurrentUserData,
} from "../../common/decorators/current-user.decorator";
import { Role } from "../../common/enums";
import { Public } from "../auth/decorators/public.decorator";

@Controller("complaints")
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createDto: CreateComplaintDto) {
    const complaint = await this.complaintsService.create(createDto);
    return {
      data: complaint,
      message: "Complaint created successfully",
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(
    @Query() filterDto: FilterComplaintsDto,
    @CurrentUser() user: CurrentUserData
  ) {
    const result = await this.complaintsService.findAll(filterDto, user);
    return {
      data: result.data,
      meta: result.meta,
      message: "Complaints retrieved successfully",
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get("trash")
  async findDeleted(@Query() filterDto: FilterComplaintsDto) {
    const result = await this.complaintsService.findDeleted(filterDto);
    return {
      data: result.data,
      meta: result.meta,
      message: "Deleted complaints retrieved successfully",
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id")
  async findOne(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserData
  ) {
    const complaint = await this.complaintsService.findOne(id, user);
    return {
      data: complaint,
      message: "Complaint retrieved successfully",
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ENGINEER, Role.CONSULTANT, Role.ADMIN)
  @Patch(":id/assign")
  async assign(
    @Param("id") id: string,
    @Body() assignDto: AssignComplaintDto,
    @CurrentUser() user: CurrentUserData
  ) {
    const complaint = await this.complaintsService.assign(id, assignDto, user);
    return {
      data: complaint,
      message: "Complaint assigned successfully",
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ENGINEER, Role.CONSULTANT, Role.ADMIN)
  @Patch(":id/status")
  async changeStatus(
    @Param("id") id: string,
    @Body() statusDto: ChangeStatusDto,
    @CurrentUser() user: CurrentUserData
  ) {
    const complaint = await this.complaintsService.changeStatus(
      id,
      statusDto,
      user
    );
    return {
      data: complaint,
      message: "Complaint status changed successfully",
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ENGINEER, Role.CONSULTANT, Role.MAINTENANCE_MANAGER, Role.ADMIN)
  @Post(":id/review-notes")
  async addReviewNote(
    @Param("id") id: string,
    @Body() dto: AddReviewNoteDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return {
      data: await this.complaintsService.addReviewNote(id, dto, user),
      message: "Review note added successfully",
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ENGINEER, Role.CONSULTANT, Role.ADMIN)
  @Patch(":id/transfer-department")
  async transferDepartment(
    @Param("id") id: string,
    @Body() dto: TransferDepartmentDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return {
      data: await this.complaintsService.transferDepartment(id, dto, user),
      message: "Complaint transferred successfully",
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ENGINEER, Role.CONSULTANT, Role.ADMIN)
  @Post(":id/create-maintenance-request")
  async createMaintenanceRequest(
    @Param("id") id: string,
    @Body() dto: CreateComplaintMaintenanceRequestDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return {
      data: await this.complaintsService.createMaintenanceRequest(id, dto, user),
      message: "Maintenance request created from complaint successfully",
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  async softDelete(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    await this.complaintsService.softDelete(id, {
      userId: user.userId,
      name: user.name,
    });
    return {
      data: null,
      message: "Complaint deleted successfully (soft delete)",
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(":id/hard")
  @HttpCode(HttpStatus.OK)
  async hardDelete(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    await this.complaintsService.hardDelete(id, {
      userId: user.userId,
      name: user.name,
    });
    return {
      data: null,
      message: "Complaint permanently deleted",
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post(":id/restore")
  @HttpCode(HttpStatus.OK)
  async restore(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    const complaint = await this.complaintsService.restore(id, {
      userId: user.userId,
      name: user.name,
    });
    return {
      data: complaint,
      message: "Complaint restored successfully",
    };
  }
}





