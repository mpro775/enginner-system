import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ComplaintsService } from "./complaints.service";
import {
  CreateComplaintDto,
  UpdateComplaintDto,
  FilterComplaintsDto,
  AssignComplaintDto,
  LinkMaintenanceRequestDto,
  ChangeStatusDto,
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
    const result = await this.complaintsService.findAll(filterDto, {
      userId: user.userId,
      role: user.role,
    });
    return {
      data: result.data,
      meta: result.meta,
      message: "Complaints retrieved successfully",
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id")
  async findOne(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserData
  ) {
    const complaint = await this.complaintsService.findOne(id, {
      userId: user.userId,
      role: user.role,
    });
    return {
      data: complaint,
      message: "Complaint retrieved successfully",
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ENGINEER, Role.ADMIN)
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() updateDto: UpdateComplaintDto,
    @CurrentUser() user: CurrentUserData
  ) {
    const complaint = await this.complaintsService.update(id, updateDto, {
      userId: user.userId,
      name: user.name,
      role: user.role,
    });
    return {
      data: complaint,
      message: "Complaint updated successfully",
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ENGINEER, Role.ADMIN)
  @Patch(":id/assign")
  async assign(
    @Param("id") id: string,
    @Body() assignDto: AssignComplaintDto,
    @CurrentUser() user: CurrentUserData
  ) {
    const complaint = await this.complaintsService.assign(id, assignDto, {
      userId: user.userId,
      name: user.name,
      role: user.role,
    });
    return {
      data: complaint,
      message: "Complaint assigned successfully",
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ENGINEER, Role.ADMIN)
  @Patch(":id/link-request")
  async linkMaintenanceRequest(
    @Param("id") id: string,
    @Body() linkDto: LinkMaintenanceRequestDto,
    @CurrentUser() user: CurrentUserData
  ) {
    const complaint = await this.complaintsService.linkMaintenanceRequest(
      id,
      linkDto,
      {
        userId: user.userId,
        name: user.name,
        role: user.role,
      }
    );
    return {
      data: complaint,
      message: "Complaint linked to maintenance request successfully",
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ENGINEER, Role.ADMIN)
  @Patch(":id/status")
  async changeStatus(
    @Param("id") id: string,
    @Body() statusDto: ChangeStatusDto,
    @CurrentUser() user: CurrentUserData
  ) {
    const complaint = await this.complaintsService.changeStatus(
      id,
      statusDto,
      {
        userId: user.userId,
        name: user.name,
        role: user.role,
      }
    );
    return {
      data: complaint,
      message: "Complaint status changed successfully",
    };
  }
}

