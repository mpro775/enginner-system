import { IsOptional, IsDateString, IsMongoId, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { MaintenanceType } from '../../../common/enums';

export class StatisticsFilterDto {
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
}

export class TopFailingMachinesFilterDto extends StatisticsFilterDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}

export class TrendsFilterDto {
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  period?: 'daily' | 'weekly' | 'monthly' = 'monthly';
}



