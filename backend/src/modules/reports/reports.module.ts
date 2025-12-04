import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import {
  MaintenanceRequest,
  MaintenanceRequestSchema,
} from '../maintenance-requests/schemas/maintenance-request.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { StatisticsModule } from '../statistics/statistics.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MaintenanceRequest.name, schema: MaintenanceRequestSchema },
      { name: User.name, schema: UserSchema },
    ]),
    StatisticsModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}






