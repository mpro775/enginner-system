import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ComplaintsService } from "./complaints.service";
import { ComplaintsController } from "./complaints.controller";
import { Complaint, ComplaintSchema } from "./schemas/complaint.schema";
import { User, UserSchema } from "../users/schemas/user.schema";
import { MaintenanceRequest, MaintenanceRequestSchema } from "../maintenance-requests/schemas/maintenance-request.schema";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { PublicComplaintsController } from "./public-complaints.controller";
import { Location, LocationSchema } from "../locations/schemas/location.schema";
import { Floor, FloorSchema } from "../floors/schemas/floor.schema";
import { Department, DepartmentSchema } from "../departments/schemas/department.schema";
import { System, SystemSchema } from "../systems/schemas/system.schema";
import { Machine, MachineSchema } from "../machines/schemas/machine.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Complaint.name, schema: ComplaintSchema },
      { name: User.name, schema: UserSchema },
      { name: MaintenanceRequest.name, schema: MaintenanceRequestSchema },
      { name: Location.name, schema: LocationSchema },
      { name: Floor.name, schema: FloorSchema },
      { name: Department.name, schema: DepartmentSchema },
      { name: System.name, schema: SystemSchema },
      { name: Machine.name, schema: MachineSchema },
    ]),
    forwardRef(() => NotificationsModule),
    forwardRef(() => AuditLogsModule),
  ],
  controllers: [ComplaintsController, PublicComplaintsController],
  providers: [ComplaintsService],
  exports: [ComplaintsService],
})
export class ComplaintsModule {}







