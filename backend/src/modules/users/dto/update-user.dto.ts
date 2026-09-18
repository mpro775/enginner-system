import {
  IsEmail,
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsMongoId,
  IsBoolean,
} from "class-validator";
import { Role } from "../../../common/enums";
import { IsSystemPassword } from "../../../common/security/password-policy";

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: "Please provide a valid email address" })
  email?: string;

  @IsOptional()
  @IsString()
  @IsSystemPassword()
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
