import { IsOptional, IsString } from 'class-validator';

export class CompleteRequestDto {
  @IsOptional()
  @IsString({ message: 'Implemented work must be a string' })
  implementedWork?: string;
}
