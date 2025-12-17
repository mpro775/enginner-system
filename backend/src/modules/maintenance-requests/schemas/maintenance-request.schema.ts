import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { MaintenanceType, RequestStatus } from "../../../common/enums";

export type MaintenanceRequestDocument = MaintenanceRequest & Document;

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_, ret) => {
      delete (ret as any).__v;
      return ret;
    },
  },
})
export class MaintenanceRequest {
  @Prop({ required: true, unique: true })
  requestCode: string;

  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  engineerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "User" })
  consultantId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "User" })
  healthSafetySupervisorId?: Types.ObjectId;

  @Prop({ required: true, enum: MaintenanceType })
  maintenanceType: MaintenanceType;

  @Prop({ type: Types.ObjectId, ref: "Location", required: true })
  locationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Department", required: true })
  departmentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "System", required: true })
  systemId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Machine", required: true })
  machineId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  reasonText: string;

  @Prop({ trim: true })
  machineNumber?: string;

  @Prop({
    required: true,
    enum: RequestStatus,
    default: RequestStatus.IN_PROGRESS,
  })
  status: RequestStatus;

  @Prop({ trim: true })
  engineerNotes?: string;

  @Prop({ trim: true })
  consultantNotes?: string;

  @Prop({ trim: true })
  healthSafetyNotes?: string;

  @Prop({ trim: true })
  stopReason?: string;

  @Prop({ default: true })
  maintainAllComponents: boolean;

  @Prop({ type: [String], default: [] })
  selectedComponents?: string[];

  @Prop({ required: true, default: () => new Date() })
  openedAt: Date;

  @Prop()
  closedAt?: Date;

  @Prop()
  stoppedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: "ScheduledTask" })
  scheduledTaskId?: Types.ObjectId;
}

export const MaintenanceRequestSchema =
  SchemaFactory.createForClass(MaintenanceRequest);

// Indexes
MaintenanceRequestSchema.index({ requestCode: 1 }, { unique: true });
MaintenanceRequestSchema.index({ engineerId: 1, status: 1 });
MaintenanceRequestSchema.index({ consultantId: 1 });
MaintenanceRequestSchema.index({ locationId: 1, departmentId: 1 });
MaintenanceRequestSchema.index({ systemId: 1, machineId: 1 });
MaintenanceRequestSchema.index({ maintenanceType: 1 });
MaintenanceRequestSchema.index({ status: 1 });
MaintenanceRequestSchema.index({ createdAt: -1 });
MaintenanceRequestSchema.index({ openedAt: -1 });
