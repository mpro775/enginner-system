import { IsOptional, IsEnum, IsMongoId, IsDateString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { MaintenanceType, RequestStatus } from '../../../common/enums';

export class FilterRequestsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @IsOptional()
  @IsMongoId()
  engineerId?: string;

  @IsOptional()
  @IsMongoId()
  consultantId?: string;

  @IsOptional()
  @IsMongoId()
  locationId?: string;

  @IsOptional()
  @IsMongoId()
  departmentId?: string;

  @IsOptional()
  @IsMongoId()
  systemId?: string;

  @IsOptional()
  @IsMongoId()
  machineId?: string;

  @IsOptional()
  @IsEnum(MaintenanceType)
  maintenanceType?: MaintenanceType;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}






