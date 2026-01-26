import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsEnum,
  IsOptional,
  IsMongoId,
} from "class-validator";
import { Role } from "../../../common/enums";

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: "Name is required" })
  name: string;

  @IsEmail({}, { message: "Please provide a valid email address" })
  @IsNotEmpty({ message: "Email is required" })
  email: string;

  @IsString()
  @IsNotEmpty({ message: "Password is required" })
  @MinLength(6, { message: "Password must be at least 6 characters" })
  password: string;

  @IsEnum(Role, {
    message:
      "Role must be admin, consultant, maintenance_manager, engineer, maintenance_safety_monitor, or project_manager",
  })
  @IsNotEmpty({ message: "Role is required" })
  role: Role;

  @IsOptional()
  @IsMongoId({ message: "Invalid department ID" })
  departmentId?: string;
}
