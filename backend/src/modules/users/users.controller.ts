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
import { UsersService } from "./users.service";
import { CreateUserDto, UpdateUserDto, FilterUsersDto } from "./dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import {
  CurrentUser,
  CurrentUserData,
} from "../../common/decorators/current-user.decorator";
import { Role } from "../../common/enums";

@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser() user: CurrentUserData
  ) {
    const newUser = await this.usersService.create(createUserDto, {
      userId: user.userId,
      name: user.name,
    });
    return {
      data: newUser,
      message: "User created successfully",
    };
  }

  @Get()
  @Roles(Role.ADMIN)
  async findAll(@Query() filterDto: FilterUsersDto) {
    const result = await this.usersService.findAll(filterDto);
    return {
      data: result.data,
      meta: result.meta,
      message: "Users retrieved successfully",
    };
  }

  @Get("engineers")
  @Roles(Role.ADMIN, Role.CONSULTANT, Role.MAINTENANCE_MANAGER)
  async getEngineers() {
    const engineers = await this.usersService.getEngineers();
    return {
      data: engineers,
      message: "Engineers retrieved successfully",
    };
  }

  @Get("consultants")
  @Roles(Role.ADMIN)
  async getConsultants() {
    const consultants = await this.usersService.getConsultants();
    return {
      data: consultants,
      message: "Consultants retrieved successfully",
    };
  }

  @Get("trash")
  @Roles(Role.ADMIN)
  async findDeleted(@Query() filterDto: FilterUsersDto) {
    const result = await this.usersService.findDeleted(filterDto);
    return {
      data: result.data,
      meta: result.meta,
      message: "Deleted users retrieved successfully",
    };
  }

  @Get(":id")
  @Roles(Role.ADMIN)
  async findOne(@Param("id") id: string) {
    const user = await this.usersService.findOne(id);
    return {
      data: user,
      message: "User retrieved successfully",
    };
  }

  @Patch(":id")
  @Roles(Role.ADMIN)
  async update(
    @Param("id") id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() user: CurrentUserData
  ) {
    const updatedUser = await this.usersService.update(id, updateUserDto, {
      userId: user.userId,
      name: user.name,
    });
    return {
      data: updatedUser,
      message: "User updated successfully",
    };
  }

  @Patch(":id/toggle-status")
  @Roles(Role.ADMIN)
  async toggleStatus(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserData
  ) {
    const updatedUser = await this.usersService.toggleStatus(id, {
      userId: user.userId,
      name: user.name,
    });
    return {
      data: updatedUser,
      message: `User ${updatedUser.isActive ? "activated" : "deactivated"} successfully`,
    };
  }

  @Delete(":id")
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async softDelete(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    await this.usersService.softDelete(id, {
      userId: user.userId,
      name: user.name,
    });
    return {
      data: null,
      message: "User deleted successfully (soft delete)",
    };
  }

  @Delete(":id/hard")
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async hardDelete(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    await this.usersService.hardDelete(id, {
      userId: user.userId,
      name: user.name,
    });
    return {
      data: null,
      message: "User permanently deleted",
    };
  }

  @Post(":id/restore")
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async restore(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    const restoredUser = await this.usersService.restore(id, {
      userId: user.userId,
      name: user.name,
    });
    return {
      data: restoredUser,
      message: "User restored successfully",
    };
  }
}
