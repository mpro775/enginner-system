import {
  IsDateString,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  Max,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export class AnalyticsFilterDto {
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

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
  @IsMongoId()
  engineerId?: string;
}

export class AnalyticsTrendFilterDto extends AnalyticsFilterDto {
  @IsOptional()
  @IsIn(["daily", "weekly", "monthly"])
  period: "daily" | "weekly" | "monthly" = "daily";
}

export class MachineProfileQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 15;
}

export class RepeatFailuresQueryDto extends AnalyticsFilterDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days = 30;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 10;
}
