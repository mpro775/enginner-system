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
import { LocationsService } from './locations.service';
import { CreateLocationDto, UpdateLocationDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserData,
} from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums';

@Controller('locations')
@UseGuards(JwtAuthGuard)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createLocationDto: CreateLocationDto) {
    const location = await this.locationsService.create(createLocationDto);
    return {
      data: location,
      message: 'Location created successfully',
    };
  }

  @Get()
  async findAll(@Query('all') all?: string) {
    const locations = await this.locationsService.findAll(all !== 'true');
    return {
      data: locations,
      message: 'Locations retrieved successfully',
    };
  }

  @Get('trash')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async findDeleted() {
    const locations = await this.locationsService.findDeleted();
    return {
      data: locations,
      message: 'Deleted locations retrieved successfully',
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const location = await this.locationsService.findOne(id);
    return {
      data: location,
      message: 'Location retrieved successfully',
    };
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateLocationDto: UpdateLocationDto,
  ) {
    const location = await this.locationsService.update(id, updateLocationDto);
    return {
      data: location,
      message: 'Location updated successfully',
    };
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async softDelete(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    await this.locationsService.softDelete(id, {
      userId: user.userId,
      name: user.name,
    });
    return {
      data: null,
      message: 'Location deleted successfully (soft delete)',
    };
  }

  @Delete(':id/hard')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async hardDelete(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    await this.locationsService.hardDelete(id, {
      userId: user.userId,
      name: user.name,
    });
    return {
      data: null,
      message: 'Location permanently deleted',
    };
  }

  @Post(':id/restore')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async restore(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    const location = await this.locationsService.restore(id, {
      userId: user.userId,
      name: user.name,
    });
    return {
      data: location,
      message: 'Location restored successfully',
    };
  }
}






