import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateSystemDto {
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}






