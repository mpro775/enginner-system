import {
  IsEmail,
  IsString,
  MinLength,
  IsEnum,
  IsOptional,
  IsMongoId,
  IsBoolean,
} from 'class-validator';
import { Role } from '../../../common/enums';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password?: string;

  @IsOptional()
  @IsEnum(Role, { message: 'Role must be admin, consultant, or engineer' })
  role?: Role;

  @IsOptional()
  @IsMongoId({ message: 'Invalid department ID' })
  departmentId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}






