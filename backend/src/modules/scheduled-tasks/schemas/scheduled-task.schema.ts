import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { TaskStatus, RepetitionInterval } from "../../../common/enums";

export type ScheduledTaskDocument = ScheduledTask & Document;

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
export class ScheduledTask {
  @Prop({ required: true, unique: true, trim: true })
  taskCode: string;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ type: Types.ObjectId, ref: "User" })
  engineerId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Location", required: true })
  locationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Department", required: true })
  departmentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "System", required: true })
  systemId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Machine", required: true })
  machineId: Types.ObjectId;

  @Prop({ default: true })
  maintainAllComponents: boolean;

  @Prop({ type: [String], default: [] })
  selectedComponents?: string[];

  @Prop({ required: true, min: 1, max: 12 })
  scheduledMonth: number;

  @Prop({ required: true })
  scheduledYear: number;

  @Prop({ type: Number, min: 1, max: 31, default: 1 })
  scheduledDay: number;

  @Prop({ trim: true })
  description?: string;

  @Prop({ enum: RepetitionInterval })
  repetitionInterval?: RepetitionInterval;

  @Prop()
  lastGeneratedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: "ScheduledTask" })
  parentTaskId?: Types.ObjectId;

  @Prop({
    required: true,
    enum: TaskStatus,
    default: TaskStatus.PENDING,
  })
  status: TaskStatus;

  @Prop({ type: Types.ObjectId, ref: "MaintenanceRequest" })
  completedRequestId?: Types.ObjectId;

  @Prop()
  completedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  createdBy: Types.ObjectId;
}

export const ScheduledTaskSchema = SchemaFactory.createForClass(ScheduledTask);

// Virtual for days remaining
ScheduledTaskSchema.virtual("daysRemaining").get(function () {
  const now = new Date();
  
  // Use scheduledDay if provided, otherwise use 1 (first day of month)
  const day = this.scheduledDay || 1;
  const targetDate = new Date(this.scheduledYear, this.scheduledMonth - 1, day);

  // Calculate days remaining
  const diffTime = targetDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
});

// Indexes
ScheduledTaskSchema.index({ taskCode: 1 }, { unique: true });
ScheduledTaskSchema.index({ engineerId: 1, status: 1 });
ScheduledTaskSchema.index({ scheduledYear: 1, scheduledMonth: 1, scheduledDay: 1 });
ScheduledTaskSchema.index({ status: 1 });
ScheduledTaskSchema.index({ createdAt: -1 });
ScheduledTaskSchema.index({ parentTaskId: 1 });
ScheduledTaskSchema.index({ repetitionInterval: 1 });
ScheduledTaskSchema.index({ engineerId: 1 }, { sparse: true }); // Sparse index for unassigned tasks
