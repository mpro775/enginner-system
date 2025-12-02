import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsMongoId,
} from 'class-validator';
import { MaintenanceType } from '../../../common/enums';

export class CreateMaintenanceRequestDto {
  @IsEnum(MaintenanceType, { message: 'Maintenance type must be emergency or preventive' })
  @IsNotEmpty({ message: 'Maintenance type is required' })
  maintenanceType: MaintenanceType;

  @IsMongoId({ message: 'Invalid location ID' })
  @IsNotEmpty({ message: 'Location is required' })
  locationId: string;

  @IsMongoId({ message: 'Invalid department ID' })
  @IsNotEmpty({ message: 'Department is required' })
  departmentId: string;

  @IsMongoId({ message: 'Invalid system ID' })
  @IsNotEmpty({ message: 'System is required' })
  systemId: string;

  @IsMongoId({ message: 'Invalid machine ID' })
  @IsNotEmpty({ message: 'Machine is required' })
  machineId: string;

  @IsString()
  @IsNotEmpty({ message: 'Reason is required' })
  reasonText: string;

  @IsOptional()
  @IsString()
  machineNumber?: string;

  @IsOptional()
  @IsString()
  engineerNotes?: string;
}




