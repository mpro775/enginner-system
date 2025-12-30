import {
  IsNotEmpty,
  IsMongoId,
} from "class-validator";

export class AssignComplaintDto {
  @IsMongoId({ message: "Invalid engineer ID" })
  @IsNotEmpty({ message: "Engineer ID is required" })
  engineerId: string;
}

