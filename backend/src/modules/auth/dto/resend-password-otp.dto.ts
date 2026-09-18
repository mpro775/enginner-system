import { IsHexadecimal, IsString, Length } from 'class-validator';

export class ResendPasswordOtpDto {
  @IsString()
  @IsHexadecimal()
  @Length(64, 64)
  challengeId: string;
}
