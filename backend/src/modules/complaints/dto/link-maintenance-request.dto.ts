import {
  IsNotEmpty,
  IsMongoId,
} from "class-validator";

export class LinkMaintenanceRequestDto {
  @IsMongoId({ message: "Invalid maintenance request ID" })
  @IsNotEmpty({ message: "Maintenance request ID is required" })
  maintenanceRequestId: string;
}

