import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsMongoId,
} from 'class-validator';

export class UpdateSystemDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true, message: 'Invalid department ID' })
  departmentIds?: string[];
}






