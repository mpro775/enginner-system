import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LocationDocument = Location & Document;

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
export class Location {
  @Prop({ required: true, trim: true, unique: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const LocationSchema = SchemaFactory.createForClass(Location);

// Indexes
LocationSchema.index({ name: 1 }, { unique: true });
LocationSchema.index({ isActive: 1 });



