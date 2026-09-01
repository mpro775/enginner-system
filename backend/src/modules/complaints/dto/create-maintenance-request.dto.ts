import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
} from "class-validator";
import { MaintenanceType } from "../../../common/enums";

export class CreateComplaintMaintenanceRequestDto {
  @IsEnum(MaintenanceType)
  maintenanceType: MaintenanceType;

  @IsOptional()
  @IsMongoId()
  engineerId?: string;

  @IsMongoId()
  systemId: string;

  @IsMongoId()
  machineId: string;

  @IsOptional()
  @IsBoolean()
  maintainAllComponents?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedComponents?: string[];

  @IsOptional()
  @IsString()
  requestNeeds?: string;

  @IsOptional()
  @IsString()
  reviewerNotes?: string;

  @IsOptional()
  @IsString()
  reviewNote?: string;
}

