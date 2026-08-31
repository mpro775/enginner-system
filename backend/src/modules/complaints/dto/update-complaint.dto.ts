import { IsString, IsOptional } from "class-validator";

export class UpdateComplaintDto {
  /** Legacy operational notes only. Original complaint source fields are immutable. */
  @IsOptional()
  @IsString()
  notesAr?: string;

  @IsOptional()
  @IsString()
  notesEn?: string;
}

