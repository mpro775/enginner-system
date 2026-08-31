import { Controller, Get, Query } from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { ComplaintsService } from "./complaints.service";

@Controller("public/complaints")
export class PublicComplaintsController {
  constructor(private complaintsService: ComplaintsService) {}

  @Public()
  @Get("reference-data")
  async referenceData() {
    return {
      data: await this.complaintsService.getPublicReferenceData(),
      message: "Complaint reference data retrieved successfully",
    };
  }

  @Public()
  @Get("floors")
  async floors(@Query("locationId") locationId: string) {
    return {
      data: await this.complaintsService.getPublicFloors(locationId),
      message: "Complaint floors retrieved successfully",
    };
  }
}

