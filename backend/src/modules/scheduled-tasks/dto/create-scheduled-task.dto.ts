import {
  IsNotEmpty,
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
import { RepetitionInterval } from "../../../common/enums";

export class CreateScheduledTaskDto {
  @IsString()
  @IsNotEmpty({ message: "Title is required" })
  title: string;

  @IsOptional()
  @IsMongoId({ message: "Invalid engineer ID" })
  engineerId?: string;

  @IsMongoId({ message: "Invalid location ID" })
  @IsNotEmpty({ message: "Location is required" })
  locationId: string;

  @IsMongoId({ message: "Invalid department ID" })
  @IsNotEmpty({ message: "Department is required" })
  departmentId: string;

  @IsMongoId({ message: "Invalid system ID" })
  @IsNotEmpty({ message: "System is required" })
  systemId: string;

  @IsMongoId({ message: "Invalid machine ID" })
  @IsNotEmpty({ message: "Machine is required" })
  machineId: string;

  @IsOptional()
  @IsBoolean()
  maintainAllComponents?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedComponents?: string[];

  @IsInt({ message: "Scheduled month must be a number" })
  @Min(1, { message: "Scheduled month must be between 1 and 12" })
  @Max(12, { message: "Scheduled month must be between 1 and 12" })
  @IsNotEmpty({ message: "Scheduled month is required" })
  scheduledMonth: number;

  @IsInt({ message: "Scheduled year must be a number" })
  @IsNotEmpty({ message: "Scheduled year is required" })
  scheduledYear: number;

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
}
