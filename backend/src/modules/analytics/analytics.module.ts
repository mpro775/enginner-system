import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";
import {
  MaintenanceRequest,
  MaintenanceRequestSchema,
} from "../maintenance-requests/schemas/maintenance-request.schema";
import {
  ScheduledTask,
  ScheduledTaskSchema,
} from "../scheduled-tasks/schemas/scheduled-task.schema";
import {
  Complaint,
  ComplaintSchema,
} from "../complaints/schemas/complaint.schema";
import { Machine, MachineSchema } from "../machines/schemas/machine.schema";
import {
  AuditLog,
  AuditLogSchema,
} from "../audit-logs/schemas/audit-log.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MaintenanceRequest.name, schema: MaintenanceRequestSchema },
      { name: ScheduledTask.name, schema: ScheduledTaskSchema },
      { name: Complaint.name, schema: ComplaintSchema },
      { name: Machine.name, schema: MachineSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
