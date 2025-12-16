import { IsNotEmpty, IsString } from 'class-validator';

export class AddHealthSafetyNoteDto {
  @IsString()
  @IsNotEmpty({ message: 'Note is required' })
  healthSafetyNotes: string;
}