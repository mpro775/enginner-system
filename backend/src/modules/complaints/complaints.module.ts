import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ComplaintsService } from "./complaints.service";
import { ComplaintsController } from "./complaints.controller";
import { Complaint, ComplaintSchema } from "./schemas/complaint.schema";
import { User, UserSchema } from "../users/schemas/user.schema";
import { MaintenanceRequest, MaintenanceRequestSchema } from "../maintenance-requests/schemas/maintenance-request.schema";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Complaint.name, schema: ComplaintSchema },
      { name: User.name, schema: UserSchema },
      { name: MaintenanceRequest.name, schema: MaintenanceRequestSchema },
    ]),
    forwardRef(() => NotificationsModule),
    forwardRef(() => AuditLogsModule),
  ],
  controllers: [ComplaintsController],
  providers: [ComplaintsService],
  exports: [ComplaintsService],
})
export class ComplaintsModule {}








