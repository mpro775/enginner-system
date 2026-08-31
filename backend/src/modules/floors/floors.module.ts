import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Floor, FloorSchema } from "./schemas/floor.schema";
import { FloorsService } from "./floors.service";
import { FloorsController } from "./floors.controller";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Floor.name, schema: FloorSchema }]),
    forwardRef(() => AuditLogsModule),
  ],
  providers: [FloorsService],
  controllers: [FloorsController],
  exports: [FloorsService, MongooseModule],
})
export class FloorsModule {}

