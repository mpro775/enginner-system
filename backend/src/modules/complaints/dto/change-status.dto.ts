import {
  IsNotEmpty,
  IsEnum,
} from "class-validator";
import { ComplaintStatus } from "../../../common/enums";

export class ChangeStatusDto {
  @IsEnum(ComplaintStatus, {
    message: "Status must be one of: new, in_progress, resolved, closed",
  })
  @IsNotEmpty({ message: "Status is required" })
  status: ComplaintStatus;
}








