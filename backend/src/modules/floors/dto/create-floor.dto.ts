import { IsMongoId, IsNotEmpty, IsString } from "class-validator";

export class CreateFloorDto {
  @IsString()
  @IsNotEmpty({ message: "Name is required" })
  name: string;

  @IsMongoId({ message: "Invalid location ID" })
  @IsNotEmpty({ message: "Location is required" })
  locationId: string;
}

