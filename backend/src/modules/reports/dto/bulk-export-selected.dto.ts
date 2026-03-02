import { ArrayNotEmpty, IsArray, IsMongoId } from 'class-validator';

export class BulkExportSelectedDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  requestIds: string[];
}
