import { IsMongoId, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class TransferDepartmentDto {
  @IsMongoId({ message: "Invalid department ID" })
  @IsNotEmpty({ message: "Target department is required" })
  toDepartmentId: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

