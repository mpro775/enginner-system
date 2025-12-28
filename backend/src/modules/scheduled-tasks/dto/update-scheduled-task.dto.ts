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
import { TaskStatus, RepetitionInterval } from "../../../common/enums";

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
  @IsInt({ message: "Scheduled day must be a number" })
  @Min(1, { message: "Scheduled day must be between 1 and 31" })
  @Max(31, { message: "Scheduled day must be between 1 and 31" })
  scheduledDay?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(RepetitionInterval, {
    message: "Repetition interval must be weekly, monthly, quarterly, or semi_annually",
  })
  repetitionInterval?: RepetitionInterval;

  @IsOptional()
  @IsEnum(TaskStatus, {
    message: "Status must be pending, completed, overdue, or cancelled",
  })
  status?: TaskStatus;
}
