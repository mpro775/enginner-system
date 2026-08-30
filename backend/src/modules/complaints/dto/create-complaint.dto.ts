import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from "class-validator";
import { ComplaintSubmissionLanguage } from "../../../common/enums";

export class CreateComplaintDto {
  @IsOptional()
  @IsEnum(ComplaintSubmissionLanguage)
  submissionLanguage?: ComplaintSubmissionLanguage;

  @ValidateIf(
    (o) =>
      !o.submissionLanguage ||
      o.submissionLanguage === ComplaintSubmissionLanguage.AR ||
      o.submissionLanguage === ComplaintSubmissionLanguage.BOTH
  )
  @IsString()
  @IsNotEmpty({ message: "Reporter name (Arabic) is required" })
  reporterNameAr?: string;

  @ValidateIf(
    (o) =>
      !o.submissionLanguage ||
      o.submissionLanguage === ComplaintSubmissionLanguage.EN ||
      o.submissionLanguage === ComplaintSubmissionLanguage.BOTH
  )
  @IsString()
  @IsNotEmpty({ message: "Reporter name (English) is required" })
  reporterNameEn?: string;

  @ValidateIf(
    (o) =>
      !o.submissionLanguage ||
      o.submissionLanguage === ComplaintSubmissionLanguage.AR ||
      o.submissionLanguage === ComplaintSubmissionLanguage.BOTH
  )
  @IsString()
  @IsNotEmpty({ message: "Location (Arabic) is required" })
  locationAr?: string;

  @ValidateIf(
    (o) =>
      !o.submissionLanguage ||
      o.submissionLanguage === ComplaintSubmissionLanguage.EN ||
      o.submissionLanguage === ComplaintSubmissionLanguage.BOTH
  )
  @IsString()
  @IsNotEmpty({ message: "Location (English) is required" })
  locationEn?: string;

  @ValidateIf(
    (o) =>
      !o.submissionLanguage ||
      o.submissionLanguage === ComplaintSubmissionLanguage.AR ||
      o.submissionLanguage === ComplaintSubmissionLanguage.BOTH
  )
  @IsString()
  @IsNotEmpty({ message: "Description (Arabic) is required" })
  descriptionAr?: string;

  @ValidateIf(
    (o) =>
      !o.submissionLanguage ||
      o.submissionLanguage === ComplaintSubmissionLanguage.EN ||
      o.submissionLanguage === ComplaintSubmissionLanguage.BOTH
  )
  @IsString()
  @IsNotEmpty({ message: "Description (English) is required" })
  descriptionEn?: string;

  @IsOptional()
  @IsString()
  notesAr?: string;

  @IsOptional()
  @IsString()
  notesEn?: string;
}


