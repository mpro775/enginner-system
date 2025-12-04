import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SystemsService } from './systems.service';
import { SystemsController } from './systems.controller';
import { System, SystemSchema } from './schemas/system.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: System.name, schema: SystemSchema }]),
  ],
  controllers: [SystemsController],
  providers: [SystemsService],
  exports: [SystemsService],
})
export class SystemsModule {}






