import { IsString, IsOptional, IsEnum, IsMongoId } from 'class-validator';
import { MaintenanceType } from '../../../common/enums';

export class UpdateMaintenanceRequestDto {
  @IsOptional()
  @IsEnum(MaintenanceType)
  maintenanceType?: MaintenanceType;

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
  @IsString()
  reasonText?: string;

  @IsOptional()
  @IsString()
  machineNumber?: string;

  @IsOptional()
  @IsString()
  engineerNotes?: string;
}






