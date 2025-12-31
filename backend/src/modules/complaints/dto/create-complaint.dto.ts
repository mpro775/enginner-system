import {
  IsNotEmpty,
  IsString,
  IsOptional,
} from "class-validator";

export class CreateComplaintDto {
  @IsString()
  @IsNotEmpty({ message: "Reporter name (Arabic) is required" })
  reporterNameAr: string;

  @IsString()
  @IsNotEmpty({ message: "Reporter name (English) is required" })
  reporterNameEn: string;

  @IsString()
  @IsNotEmpty({ message: "Location (Arabic) is required" })
  locationAr: string;

  @IsString()
  @IsNotEmpty({ message: "Location (English) is required" })
  locationEn: string;

  @IsString()
  @IsNotEmpty({ message: "Description (Arabic) is required" })
  descriptionAr: string;

  @IsString()
  @IsNotEmpty({ message: "Description (English) is required" })
  descriptionEn: string;

  @IsOptional()
  @IsString()
  notesAr?: string;

  @IsOptional()
  @IsString()
  notesEn?: string;
}



