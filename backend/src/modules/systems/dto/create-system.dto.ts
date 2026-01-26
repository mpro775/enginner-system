import { IsNotEmpty, IsString, IsOptional, IsMongoId } from 'class-validator';

export class CreateSystemDto {
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsMongoId({ message: 'Invalid department ID' })
  departmentId?: string;
}






