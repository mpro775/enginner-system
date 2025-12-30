import {
  IsNotEmpty,
  IsString,
  IsOptional,
} from "class-validator";

export class CreateComplaintDto {
  @IsString()
  @IsNotEmpty({ message: "Reporter name is required" })
  reporterName: string;

  @IsString()
  @IsNotEmpty({ message: "Department is required" })
  department: string;

  @IsString()
  @IsNotEmpty({ message: "Machine is required" })
  machine: string;

  @IsOptional()
  @IsString()
  machineNumber?: string;

  @IsString()
  @IsNotEmpty({ message: "Location is required" })
  location: string;

  @IsString()
  @IsNotEmpty({ message: "Description is required" })
  description: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

