import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AdminSearchController } from "./admin-search.controller";
import { AdminSearchService } from "./admin-search.service";
import {
  MaintenanceRequest,
  MaintenanceRequestSchema,
} from "../maintenance-requests/schemas/maintenance-request.schema";
import { Machine, MachineSchema } from "../machines/schemas/machine.schema";
import {
  Complaint,
  ComplaintSchema,
} from "../complaints/schemas/complaint.schema";
import { User, UserSchema } from "../users/schemas/user.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MaintenanceRequest.name, schema: MaintenanceRequestSchema },
      { name: Machine.name, schema: MachineSchema },
      { name: Complaint.name, schema: ComplaintSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [AdminSearchController],
  providers: [AdminSearchService],
})
export class AdminSearchModule {}
