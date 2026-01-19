import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DepartmentDocument = Department & Document;

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
export class Department {
  @Prop({ required: true, trim: true, unique: true })
  name: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Date, default: null })
  deletedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  deletedBy?: Types.ObjectId;
}

export const DepartmentSchema = SchemaFactory.createForClass(Department);

// Indexes
DepartmentSchema.index({ name: 1 }, { unique: true });
DepartmentSchema.index({ isActive: 1 });
DepartmentSchema.index({ deletedAt: 1 });



