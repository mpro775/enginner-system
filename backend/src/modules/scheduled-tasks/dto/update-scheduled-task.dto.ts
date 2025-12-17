import {
  IsString,
  IsEnum,
  IsMongoId,
  IsArray,
  IsBoolean,
  IsOptional,
  IsInt,
  Min,
  Max,
} from "class-validator";
import { MaintenanceType, TaskStatus } from "../../../common/enums";

export class UpdateScheduledTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsMongoId({ message: "Invalid engineer ID" })
  engineerId?: string;

  @IsOptional()
  @IsMongoId({ message: "Invalid location ID" })
  locationId?: string;

  @IsOptional()
  @IsMongoId({ message: "Invalid department ID" })
  departmentId?: string;

  @IsOptional()
  @IsMongoId({ message: "Invalid system ID" })
  systemId?: string;

  @IsOptional()
  @IsMongoId({ message: "Invalid machine ID" })
  machineId?: string;

  @IsOptional()
  @IsBoolean()
  maintainAllComponents?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedComponents?: string[];

  @IsOptional()
  @IsInt({ message: "Scheduled month must be a number" })
  @Min(1, { message: "Scheduled month must be between 1 and 12" })
  @Max(12, { message: "Scheduled month must be between 1 and 12" })
  scheduledMonth?: number;

  @IsOptional()
  @IsInt({ message: "Scheduled year must be a number" })
  scheduledYear?: number;

  @IsOptional()
  @IsEnum(MaintenanceType, {
    message: "Task type must be emergency or preventive",
  })
  taskType?: MaintenanceType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TaskStatus, {
    message: "Status must be pending, completed, overdue, or cancelled",
  })
  status?: TaskStatus;
}
