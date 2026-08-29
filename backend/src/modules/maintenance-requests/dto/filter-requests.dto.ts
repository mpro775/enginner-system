import {
  IsOptional,
  IsEnum,
  IsMongoId,
  IsDateString,
  IsIn,
  IsBoolean,
} from "class-validator";
import { Transform } from "class-transformer";
import { PaginationDto } from "../../../common/dto/pagination.dto";
import { MaintenanceType, RequestStatus } from "../../../common/enums";

export class FilterRequestsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  openOnly?: boolean;

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

  @IsOptional()
  @IsDateString()
  openedBefore?: string;

  @IsOptional()
  @IsIn(["createdAt", "openedAt", "requestCode", "status", "maintenanceType"])
  sortBy?: string = "createdAt";

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortOrder?: "asc" | "desc" = "desc";
}
