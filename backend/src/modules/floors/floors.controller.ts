import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { FloorsService } from "./floors.service";
import { CreateFloorDto, UpdateFloorDto } from "./dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "../../common/enums";
import { CurrentUser, CurrentUserData } from "../../common/decorators/current-user.decorator";

@Controller("floors")
@UseGuards(JwtAuthGuard)
export class FloorsController {
  constructor(private floorsService: FloorsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateFloorDto) {
    return { data: await this.floorsService.create(dto), message: "Floor created successfully" };
  }

  @Get()
  async findAll(@Query("all") all?: string) {
    return { data: await this.floorsService.findAll(all !== "true"), message: "Floors retrieved successfully" };
  }

  @Get("by-location/:locationId")
  async byLocation(@Param("locationId") locationId: string) {
    return { data: await this.floorsService.findByLocation(locationId), message: "Floors retrieved successfully" };
  }

  @Get("trash")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async trash() {
    return { data: await this.floorsService.findDeleted(), message: "Deleted floors retrieved successfully" };
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return { data: await this.floorsService.findOne(id), message: "Floor retrieved successfully" };
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async update(@Param("id") id: string, @Body() dto: UpdateFloorDto) {
    return { data: await this.floorsService.update(id, dto), message: "Floor updated successfully" };
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async softDelete(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    await this.floorsService.softDelete(id, { userId: user.userId, name: user.name });
    return { data: null, message: "Floor deleted successfully" };
  }

  @Delete(":id/hard")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async hardDelete(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    await this.floorsService.hardDelete(id, { userId: user.userId, name: user.name });
    return { data: null, message: "Floor permanently deleted" };
  }

  @Post(":id/restore")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async restore(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    return { data: await this.floorsService.restore(id, { userId: user.userId, name: user.name }), message: "Floor restored successfully" };
  }
}

