import { IsString, IsOptional, IsBoolean, IsMongoId } from 'class-validator';

export class UpdateMachineDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsMongoId({ message: 'Invalid system ID' })
  systemId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}





