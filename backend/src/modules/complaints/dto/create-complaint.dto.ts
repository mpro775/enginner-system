import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsMongoId,
  Matches,
  ValidateIf,
} from "class-validator";
import { Transform } from "class-transformer";
import { ComplaintSubmissionLanguage } from "../../../common/enums";

export class CreateComplaintDto {
  @IsMongoId({ message: "Invalid location ID" })
  @IsNotEmpty({ message: "Location is required" })
  locationId: string;

  @IsMongoId({ message: "Invalid floor ID" })
  @IsNotEmpty({ message: "Floor is required" })
  floorId: string;

  @IsString()
  @IsNotEmpty({ message: "Detailed location is required" })
  detailedLocation: string;

  @IsMongoId({ message: "Invalid department ID" })
  @IsNotEmpty({ message: "Department is required" })
  departmentId: string;

  @IsOptional()
  @Transform(({ value }) => normalizeSaudiMobile(value))
  @Matches(/^\+9665\d{8}$/, { message: "Invalid Saudi mobile number" })
  contactPhone?: string;

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

  @IsOptional()
  @IsString()
  locationAr?: string;

  @IsOptional()
  @IsString()
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

export function normalizeSaudiMobile(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const compact = value.replace(/[\s-]/g, "").trim();
  if (!compact) return undefined;
  if (/^05\d{8}$/.test(compact)) return `+966${compact.slice(1)}`;
  if (/^5\d{8}$/.test(compact)) return `+966${compact}`;
  if (/^9665\d{8}$/.test(compact)) return `+${compact}`;
  return compact;
}

