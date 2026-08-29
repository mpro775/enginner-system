import { Type } from "class-transformer";
import {
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class AdminSearchDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  q: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  limit = 5;
}
