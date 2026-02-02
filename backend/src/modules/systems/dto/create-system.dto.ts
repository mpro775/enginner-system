import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  IsMongoId,
} from 'class-validator';

export class CreateSystemDto {
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true, message: 'Invalid department ID' })
  departmentIds?: string[];
}






