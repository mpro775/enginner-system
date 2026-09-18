import { IsHexadecimal, IsNotEmpty, IsString, Length } from 'class-validator';
import { IsSystemPassword } from '../../../common/security/password-policy';

export class ResetPasswordDto {
  @IsString()
  @IsHexadecimal()
  @Length(64, 128)
  resetToken: string;

  @IsString()
  @IsNotEmpty()
  @IsSystemPassword()
  newPassword: string;
}
