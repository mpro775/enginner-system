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
  async remove(@Param('id') id: string) {
    await this.machinesService.remove(id);
    return {
      data: null,
      message: 'Machine deleted successfully',
    };
  }
}






