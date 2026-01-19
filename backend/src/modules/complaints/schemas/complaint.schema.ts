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
  reporterNameAr: string;

  @Prop({ required: true, trim: true })
  reporterNameEn: string;

  @Prop({ required: true, trim: true })
  locationAr: string;

  @Prop({ required: true, trim: true })
  locationEn: string;

  @Prop({ required: true, trim: true })
  descriptionAr: string;

  @Prop({ required: true, trim: true })
  descriptionEn: string;

  @Prop({ trim: true })
  notesAr?: string;

  @Prop({ trim: true })
  notesEn?: string;

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

  @Prop({ type: Date, default: null })
  deletedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: "User" })
  deletedBy?: Types.ObjectId;
}

export const ComplaintSchema = SchemaFactory.createForClass(Complaint);

// Indexes
ComplaintSchema.index({ complaintCode: 1 }, { unique: true });
ComplaintSchema.index({ status: 1 });
ComplaintSchema.index({ assignedEngineerId: 1 });
ComplaintSchema.index({ maintenanceRequestId: 1 });
ComplaintSchema.index({ createdAt: -1 });
ComplaintSchema.index({ deletedAt: 1 });
// Text indexes for bilingual search
ComplaintSchema.index({ reporterNameAr: "text", reporterNameEn: "text" });
ComplaintSchema.index({ locationAr: "text", locationEn: "text" });
ComplaintSchema.index({ descriptionAr: "text", descriptionEn: "text" });
