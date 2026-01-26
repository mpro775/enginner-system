import { IsNotEmpty, IsString } from 'class-validator';

export class AddProjectManagerNoteDto {
  @IsString()
  @IsNotEmpty({ message: 'Note is required' })
  projectManagerNotes: string;
}
