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
import { SystemsService } from './systems.service';
import { CreateSystemDto, UpdateSystemDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserData,
} from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums';

@Controller('systems')
@UseGuards(JwtAuthGuard)
export class SystemsController {
  constructor(private readonly systemsService: SystemsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createSystemDto: CreateSystemDto) {
    const system = await this.systemsService.create(createSystemDto);
    return {
      data: system,
      message: 'System created successfully',
    };
  }

  @Get()
  async findAll(@Query('all') all?: string) {
    const systems = await this.systemsService.findAll(all !== 'true');
    return {
      data: systems,
      message: 'Systems retrieved successfully',
    };
  }

  @Get('by-department/:departmentId')
  async findByDepartment(@Param('departmentId') departmentId: string) {
    const systems = await this.systemsService.findByDepartment(departmentId);
    return {
      data: systems,
      message: 'Systems retrieved successfully',
    };
  }

  @Get('trash')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async findDeleted() {
    const systems = await this.systemsService.findDeleted();
    return {
      data: systems,
      message: 'Deleted systems retrieved successfully',
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const system = await this.systemsService.findOne(id);
    return {
      data: system,
      message: 'System retrieved successfully',
    };
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateSystemDto: UpdateSystemDto,
  ) {
    const system = await this.systemsService.update(id, updateSystemDto);
    return {
      data: system,
      message: 'System updated successfully',
    };
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async softDelete(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    await this.systemsService.softDelete(id, {
      userId: user.userId,
      name: user.name,
    });
    return {
      data: null,
      message: 'System deleted successfully (soft delete)',
    };
  }

  @Delete(':id/hard')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async hardDelete(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    await this.systemsService.hardDelete(id, {
      userId: user.userId,
      name: user.name,
    });
    return {
      data: null,
      message: 'System permanently deleted',
    };
  }

  @Post(':id/restore')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async restore(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    const system = await this.systemsService.restore(id, {
      userId: user.userId,
      name: user.name,
    });
    return {
      data: system,
      message: 'System restored successfully',
    };
  }
}






