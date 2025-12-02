import { IsNotEmpty, IsString } from 'class-validator';

export class StopRequestDto {
  @IsString()
  @IsNotEmpty({ message: 'Stop reason is required' })
  stopReason: string;
}

