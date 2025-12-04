import { IsOptional, IsEnum, IsMongoId, IsDateString, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { AuditAction } from '../../../common/enums';

export class FilterAuditLogsDto extends PaginationDto {
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @IsOptional()
  @IsString()
  entity?: string;

  @IsOptional()
  @IsMongoId()
  entityId?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}






