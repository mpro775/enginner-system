import { IsOptional, IsEnum, IsMongoId, IsInt } from "class-validator";
import { PaginationDto } from "../../../common/dto/pagination.dto";
import { TaskStatus } from "../../../common/enums";

export class FilterScheduledTasksDto extends PaginationDto {
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

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
  @IsMongoId()
  machineId?: string;

  @IsOptional()
  @IsInt()
  scheduledMonth?: number;

  @IsOptional()
  @IsInt()
  scheduledYear?: number;
}
