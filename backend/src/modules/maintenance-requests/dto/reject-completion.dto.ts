import { IsNotEmpty, IsString } from "class-validator";

export class RejectCompletionDto {
  @IsString()
  @IsNotEmpty({ message: "Rejection reason is required" })
  reason: string;
}

