import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { FilterAuditLogsDto } from './dto/filter-audit-logs.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  async findAll(@Query() filterDto: FilterAuditLogsDto) {
    const result = await this.auditLogsService.findAll(filterDto);
    return {
      data: result.data,
      meta: result.meta,
      message: 'Audit logs retrieved successfully',
    };
  }

  @Get('entity/:entity/:entityId')
  async findByEntity(
    @Param('entity') entity: string,
    @Param('entityId') entityId: string,
  ) {
    const logs = await this.auditLogsService.findByEntity(entity, entityId);
    return {
      data: logs,
      message: 'Audit logs retrieved successfully',
    };
  }
}





