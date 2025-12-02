import { IsNotEmpty, IsString } from 'class-validator';

export class AddNoteDto {
  @IsString()
  @IsNotEmpty({ message: 'Note is required' })
  consultantNotes: string;
}

