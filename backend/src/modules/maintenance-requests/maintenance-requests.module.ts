import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MaintenanceRequestsService } from "./maintenance-requests.service";
import { MaintenanceRequestsController } from "./maintenance-requests.controller";
import {
  MaintenanceRequest,
  MaintenanceRequestSchema,
} from "./schemas/maintenance-request.schema";
import { Machine, MachineSchema } from "../machines/schemas/machine.schema";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { ScheduledTasksModule } from "../scheduled-tasks/scheduled-tasks.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MaintenanceRequest.name, schema: MaintenanceRequestSchema },
      { name: Machine.name, schema: MachineSchema },
    ]),
    forwardRef(() => NotificationsModule),
    forwardRef(() => AuditLogsModule),
    forwardRef(() => ScheduledTasksModule),
  ],
  controllers: [MaintenanceRequestsController],
  providers: [MaintenanceRequestsService],
  exports: [MaintenanceRequestsService],
})
export class MaintenanceRequestsModule {}
