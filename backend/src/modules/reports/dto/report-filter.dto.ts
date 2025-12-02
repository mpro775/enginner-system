import { IsOptional, IsDateString, IsMongoId, IsEnum } from 'class-validator';
import { MaintenanceType, RequestStatus } from '../../../common/enums';

export class ReportFilterDto {
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

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
  @IsEnum(MaintenanceType)
  maintenanceType?: MaintenanceType;

  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @IsOptional()
  format?: 'json' | 'excel' | 'pdf' = 'json';
}





