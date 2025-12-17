import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ScheduledTasksService } from "./scheduled-tasks.service";
import { ScheduledTasksController } from "./scheduled-tasks.controller";
import {
  ScheduledTask,
  ScheduledTaskSchema,
} from "./schemas/scheduled-task.schema";
import { Machine, MachineSchema } from "../machines/schemas/machine.schema";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ScheduledTask.name, schema: ScheduledTaskSchema },
      { name: Machine.name, schema: MachineSchema },
    ]),
    forwardRef(() => AuditLogsModule),
  ],
  controllers: [ScheduledTasksController],
  providers: [ScheduledTasksService],
  exports: [ScheduledTasksService],
})
export class ScheduledTasksModule {}
