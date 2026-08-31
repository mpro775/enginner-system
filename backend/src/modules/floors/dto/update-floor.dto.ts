import { IsBoolean, IsMongoId, IsOptional, IsString } from "class-validator";

export class UpdateFloorDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsMongoId({ message: "Invalid location ID" })
  locationId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

