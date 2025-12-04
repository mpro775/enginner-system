import { IsOptional, IsPositive, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  sortBy?: string = 'createdAt';

  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}






