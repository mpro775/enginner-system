import { IsString, IsOptional, IsBoolean, IsMongoId } from 'class-validator';

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
  @IsMongoId({ message: 'Invalid department ID' })
  departmentId?: string;
}






