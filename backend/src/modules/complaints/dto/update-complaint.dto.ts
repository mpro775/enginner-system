import {
  IsString,
  IsOptional,
} from "class-validator";

export class UpdateComplaintDto {
  @IsOptional()
  @IsString()
  reporterName?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  machine?: string;

  @IsOptional()
  @IsString()
  machineNumber?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}


