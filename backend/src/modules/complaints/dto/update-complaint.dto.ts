import {
  IsString,
  IsOptional,
} from "class-validator";

export class UpdateComplaintDto {
  @IsOptional()
  @IsString()
  reporterNameAr?: string;

  @IsOptional()
  @IsString()
  reporterNameEn?: string;

  @IsOptional()
  @IsString()
  locationAr?: string;

  @IsOptional()
  @IsString()
  locationEn?: string;

  @IsOptional()
  @IsString()
  descriptionAr?: string;

  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @IsOptional()
  @IsString()
  notesAr?: string;

  @IsOptional()
  @IsString()
  notesEn?: string;
}



