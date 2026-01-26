import { IsBoolean, IsNotEmpty } from 'class-validator';

export class ApproveRequestDto {
  @IsBoolean({ message: 'isApproved must be a boolean' })
  @IsNotEmpty({ message: 'isApproved is required' })
  isApproved: boolean;
}
