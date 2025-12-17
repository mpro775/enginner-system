import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsMongoId,
  IsArray,
} from "class-validator";

export class CreateMachineDto {
  @IsString()
  @IsNotEmpty({ message: "Name is required" })
  name: string;

  @IsMongoId({ message: "Invalid system ID" })
  @IsNotEmpty({ message: "System ID is required" })
  systemId: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  components?: string[];
}
