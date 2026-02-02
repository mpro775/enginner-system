import {
  IsEmail,
  IsString,
  MinLength,
  IsEnum,
  IsOptional,
  IsArray,
  IsMongoId,
  IsBoolean,
} from "class-validator";
import { Role } from "../../../common/enums";

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: "Please provide a valid email address" })
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: "Password must be at least 6 characters" })
  password?: string;

  @IsOptional()
  @IsEnum(Role, {
    message:
      "Role must be admin, consultant, maintenance_manager, engineer, or maintenance_safety_monitor",
  })
  role?: Role;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true, message: "Invalid department ID" })
  departmentIds?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
