import { IsNotEmpty, IsString } from 'class-validator';
import { IsSystemPassword } from '../../../common/security/password-policy';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsString()
  @IsNotEmpty()
  @IsSystemPassword()
  newPassword: string;
}
