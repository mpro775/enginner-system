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
import { MachinesService } from './machines.service';
import { CreateMachineDto, UpdateMachineDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserData,
} from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums';

@Controller('machines')
@UseGuards(JwtAuthGuard)
export class MachinesController {
  constructor(private readonly machinesService: MachinesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createMachineDto: CreateMachineDto) {
    const machine = await this.machinesService.create(createMachineDto);
    return {
      data: machine,
      message: 'Machine created successfully',
    };
  }

  @Get()
  async findAll(@Query('all') all?: string) {
    const machines = await this.machinesService.findAll(all !== 'true');
    return {
      data: machines,
      message: 'Machines retrieved successfully',
    };
  }

  @Get('by-system/:systemId')
  async findBySystem(
    @Param('systemId') systemId: string,
    @Query('all') all?: string,
  ) {
    const machines = await this.machinesService.findBySystem(systemId, all !== 'true');
    return {
      data: machines,
      message: 'Machines retrieved successfully',
    };
  }

  @Get('trash')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async findDeleted() {
    const machines = await this.machinesService.findDeleted();
    return {
      data: machines,
      message: 'Deleted machines retrieved successfully',
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const machine = await this.machinesService.findOne(id);
    return {
      data: machine,
      message: 'Machine retrieved successfully',
    };
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateMachineDto: UpdateMachineDto,
  ) {
    const machine = await this.machinesService.update(id, updateMachineDto);
    return {
      data: machine,
      message: 'Machine updated successfully',
    };
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async softDelete(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    await this.machinesService.softDelete(id, {
      userId: user.userId,
      name: user.name,
    });
    return {
      data: null,
      message: 'Machine deleted successfully (soft delete)',
    };
  }

  @Delete(':id/hard')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async hardDelete(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    await this.machinesService.hardDelete(id, {
      userId: user.userId,
      name: user.name,
    });
    return {
      data: null,
      message: 'Machine permanently deleted',
    };
  }

  @Post(':id/restore')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async restore(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    const machine = await this.machinesService.restore(id, {
      userId: user.userId,
      name: user.name,
    });
    return {
      data: machine,
      message: 'Machine restored successfully',
    };
  }
}






