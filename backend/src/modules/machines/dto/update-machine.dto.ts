import {
  IsString,
  IsOptional,
  IsBoolean,
  IsMongoId,
  IsArray,
} from "class-validator";

export class UpdateMachineDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsMongoId({ message: "Invalid system ID" })
  systemId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  components?: string[];
}
