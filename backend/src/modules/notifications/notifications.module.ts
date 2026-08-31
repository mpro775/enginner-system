import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { MaintenanceRequest, MaintenanceRequestSchema } from '../maintenance-requests/schemas/maintenance-request.schema';
import { ScheduledTask, ScheduledTaskSchema } from '../scheduled-tasks/schemas/scheduled-task.schema';
import { Complaint, ComplaintSchema } from '../complaints/schemas/complaint.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: MaintenanceRequest.name, schema: MaintenanceRequestSchema },
      { name: ScheduledTask.name, schema: ScheduledTaskSchema },
      { name: Complaint.name, schema: ComplaintSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [NotificationsGateway, NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsGateway],
})
export class NotificationsModule {}





