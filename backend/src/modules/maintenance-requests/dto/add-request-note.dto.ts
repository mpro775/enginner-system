import { IsNotEmpty, IsString } from "class-validator";

export class AddRequestNoteDto {
  @IsString()
  @IsNotEmpty({ message: "Note body is required" })
  body: string;
}

