import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ScheduledTasksService } from "./scheduled-tasks.service";
import { ScheduledTasksController } from "./scheduled-tasks.controller";
import { ScheduledTasksSchedulerService } from "./scheduled-tasks-scheduler.service";
import {
  ScheduledTask,
  ScheduledTaskSchema,
} from "./schemas/scheduled-task.schema";
import { Machine, MachineSchema } from "../machines/schemas/machine.schema";
import { User, UserSchema } from "../users/schemas/user.schema";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ScheduledTask.name, schema: ScheduledTaskSchema },
      { name: Machine.name, schema: MachineSchema },
      { name: User.name, schema: UserSchema },
    ]),
    forwardRef(() => AuditLogsModule),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [ScheduledTasksController],
  providers: [ScheduledTasksService, ScheduledTasksSchedulerService],
  exports: [ScheduledTasksService],
})
export class ScheduledTasksModule {}
