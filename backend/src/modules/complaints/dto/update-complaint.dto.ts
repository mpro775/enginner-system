import {
  IsEnum,
  IsString,
  IsOptional,
} from "class-validator";
import { ComplaintSubmissionLanguage } from "../../../common/enums";

export class UpdateComplaintDto {
  @IsOptional()
  @IsEnum(ComplaintSubmissionLanguage)
  submissionLanguage?: ComplaintSubmissionLanguage;

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


