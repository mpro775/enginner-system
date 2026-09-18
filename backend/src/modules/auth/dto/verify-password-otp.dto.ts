import { IsHexadecimal, IsString, Length, Matches } from 'class-validator';

export class VerifyPasswordOtpDto {
  @IsString()
  @IsHexadecimal()
  @Length(64, 64)
  challengeId: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP must contain exactly 6 digits' })
  otp: string;
}
