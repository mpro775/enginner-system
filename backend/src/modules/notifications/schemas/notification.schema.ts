import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, SchemaTypes, Types } from "mongoose";

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_, ret) => {
      delete (ret as any).__v;
      delete (ret as any).eventKey;
      return ret;
    },
  },
})
export class Notification {
  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  recipientUserId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  type: string;

  @Prop({ trim: true })
  entityType?: string;

  @Prop({ trim: true })
  entityId?: string;

  @Prop({ required: true, trim: true })
  message: string;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  data: Record<string, unknown>;

  @Prop({ type: Date, default: null })
  readAt: Date | null;

  @Prop({ required: true })
  eventKey: string;

  createdAt: Date;
  updatedAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ recipientUserId: 1, readAt: 1, createdAt: -1 });
NotificationSchema.index({ recipientUserId: 1, createdAt: -1 });
NotificationSchema.index({ recipientUserId: 1, eventKey: 1 }, { unique: true });
