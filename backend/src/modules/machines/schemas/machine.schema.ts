import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MachineDocument = Machine & Document;

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
export class Machine {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: Types.ObjectId, ref: 'System', required: true })
  systemId: Types.ObjectId;

  @Prop({ trim: true })
  description?: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const MachineSchema = SchemaFactory.createForClass(Machine);

// Indexes
MachineSchema.index({ systemId: 1 });
MachineSchema.index({ name: 1, systemId: 1 }, { unique: true });
MachineSchema.index({ isActive: 1 });



