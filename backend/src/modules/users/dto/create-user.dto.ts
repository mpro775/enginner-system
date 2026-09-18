import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsMongoId,
} from "class-validator";
import { Role } from "../../../common/enums";
import { IsSystemPassword } from "../../../common/security/password-policy";

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: "Name is required" })
  name: string;

  @IsEmail({}, { message: "Please provide a valid email address" })
  @IsNotEmpty({ message: "Email is required" })
  email: string;

  @IsString()
  @IsNotEmpty({ message: "Password is required" })
  @IsSystemPassword()
  password: string;

  @IsEnum(Role, {
    message:
      "Role must be admin, consultant, maintenance_manager, engineer, maintenance_safety_monitor, or project_manager",
  })
  @IsNotEmpty({ message: "Role is required" })
  role: Role;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true, message: "Invalid department ID" })
  departmentIds?: string[];
}
