import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { ComplaintStatus } from "../../../common/enums";

export type ComplaintDocument = Complaint & Document;

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
export class Complaint {
  @Prop({ required: true, unique: true })
  complaintCode: string;

  @Prop({ required: true, trim: true })
  reporterName: string;

  @Prop({ required: true, trim: true })
  department: string;

  @Prop({ required: true, trim: true })
  machine: string;

  @Prop({ trim: true })
  machineNumber?: string;

  @Prop({ required: true, trim: true })
  location: string;

  @Prop({ required: true, trim: true })
  description: string;

  @Prop({ trim: true })
  notes?: string;

  @Prop({
    required: true,
    enum: ComplaintStatus,
    default: ComplaintStatus.NEW,
  })
  status: ComplaintStatus;

  @Prop({ type: Types.ObjectId, ref: "User" })
  assignedEngineerId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "MaintenanceRequest" })
  maintenanceRequestId?: Types.ObjectId;

  @Prop()
  resolvedAt?: Date;

  @Prop()
  closedAt?: Date;
}

export const ComplaintSchema = SchemaFactory.createForClass(Complaint);

// Indexes
ComplaintSchema.index({ complaintCode: 1 }, { unique: true });
ComplaintSchema.index({ status: 1 });
ComplaintSchema.index({ assignedEngineerId: 1 });
ComplaintSchema.index({ maintenanceRequestId: 1 });
ComplaintSchema.index({ createdAt: -1 });

