import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Role } from '../../../common/enums';

export type UserDocument = User & Document;

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_, ret) => {
      delete (ret as any).password;
      delete (ret as any).__v;
      return ret;
    },
  },
})
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true, enum: Role, default: Role.ENGINEER })
  role: Role;

  @Prop({ type: [Types.ObjectId], ref: 'Department', default: [] })
  departmentIds?: Types.ObjectId[];

  /** @deprecated Use departmentIds. Kept for backward compatibility with migrated data. */
  @Prop({ type: Types.ObjectId, ref: 'Department', select: false })
  departmentId?: Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  refreshToken?: string;

  @Prop()
  lastLoginAt?: Date;

  @Prop({ type: Date, default: null })
  deletedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  deletedBy?: Types.ObjectId;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Indexes
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ role: 1, isActive: 1 });
UserSchema.index({ deletedAt: 1 });



