import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserData,
} from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums';

@Controller('departments')
@UseGuards(JwtAuthGuard)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createDepartmentDto: CreateDepartmentDto) {
    const department = await this.departmentsService.create(createDepartmentDto);
    return {
      data: department,
      message: 'Department created successfully',
    };
  }

  @Get()
  async findAll(@Query('all') all?: string) {
    const departments = await this.departmentsService.findAll(all !== 'true');
    return {
      data: departments,
      message: 'Departments retrieved successfully',
    };
  }

  @Get('trash')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async findDeleted() {
    const departments = await this.departmentsService.findDeleted();
    return {
      data: departments,
      message: 'Deleted departments retrieved successfully',
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const department = await this.departmentsService.findOne(id);
    return {
      data: department,
      message: 'Department retrieved successfully',
    };
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateDepartmentDto: UpdateDepartmentDto,
  ) {
    const department = await this.departmentsService.update(id, updateDepartmentDto);
    return {
      data: department,
      message: 'Department updated successfully',
    };
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async softDelete(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    await this.departmentsService.softDelete(id, {
      userId: user.userId,
      name: user.name,
    });
    return {
      data: null,
      message: 'Department deleted successfully (soft delete)',
    };
  }

  @Delete(':id/hard')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async hardDelete(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    await this.departmentsService.hardDelete(id, {
      userId: user.userId,
      name: user.name,
    });
    return {
      data: null,
      message: 'Department permanently deleted',
    };
  }

  @Post(':id/restore')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async restore(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    const department = await this.departmentsService.restore(id, {
      userId: user.userId,
      name: user.name,
    });
    return {
      data: department,
      message: 'Department restored successfully',
    };
  }
}






