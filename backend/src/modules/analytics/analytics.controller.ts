import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import {
  AnalyticsFilterDto,
  AnalyticsTrendFilterDto,
  MachineProfileQueryDto,
  RepeatFailuresQueryDto,
} from "./dto/analytics-filter.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "../../common/enums";

@Controller("analytics")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("operations-dashboard")
  async getOperationsDashboard(@Query() filter: AnalyticsFilterDto) {
    return {
      data: await this.analyticsService.getOperationsDashboard(filter),
      message: "Operations dashboard analytics retrieved successfully",
    };
  }

  @Get("overview")
  async getOverview(@Query() filter: AnalyticsTrendFilterDto) {
    return {
      data: await this.analyticsService.getOverview(filter),
      message: "Analytics overview retrieved successfully",
    };
  }

  @Get("aging")
  async getAging(@Query() filter: AnalyticsFilterDto) {
    return {
      data: await this.analyticsService.getAging(filter),
      message: "Request aging analytics retrieved successfully",
    };
  }

  @Get("comparisons")
  async getComparisons(@Query() filter: AnalyticsFilterDto) {
    return {
      data: await this.analyticsService.getComparisons(filter),
      message: "Period comparisons retrieved successfully",
    };
  }

  @Get("heatmaps/day-hour")
  async getDayHourHeatmap(@Query() filter: AnalyticsFilterDto) {
    return {
      data: await this.analyticsService.getDayHourHeatmap(filter),
      message: "Day and hour heatmap retrieved successfully",
    };
  }

  @Get("heatmaps/location-system")
  async getLocationSystemHeatmap(@Query() filter: AnalyticsFilterDto) {
    return {
      data: await this.analyticsService.getLocationSystemHeatmap(filter),
      message: "Location and system heatmap retrieved successfully",
    };
  }

  @Get("preventive/summary")
  async getPreventiveSummary(@Query() filter: AnalyticsFilterDto) {
    return {
      data: await this.analyticsService.getPreventiveSummary(filter),
      message: "Preventive maintenance summary retrieved successfully",
    };
  }

  @Get("preventive/upcoming")
  async getUpcomingPreventive(@Query() filter: AnalyticsFilterDto) {
    return {
      data: await this.analyticsService.getUpcomingPreventive(filter),
      message: "Upcoming preventive tasks retrieved successfully",
    };
  }

  @Get("preventive/calendar")
  async getPreventiveCalendar(@Query() filter: AnalyticsFilterDto) {
    return {
      data: await this.analyticsService.getPreventiveCalendar(filter),
      message: "Preventive maintenance calendar retrieved successfully",
    };
  }

  @Get("machines/:id/profile")
  async getMachineProfile(
    @Param("id") id: string,
    @Query() query: MachineProfileQueryDto,
  ) {
    return {
      data: await this.analyticsService.getMachineProfile(id, query),
      message: "Machine intelligence profile retrieved successfully",
    };
  }

  @Get("repeat-failures")
  async getRepeatFailures(@Query() query: RepeatFailuresQueryDto) {
    return {
      data: await this.analyticsService.getRepeatFailureAnalytics(query),
      message: "Repeat failure analytics retrieved successfully",
    };
  }

  @Get("requests/:id/activity")
  async getRequestActivity(@Param("id") id: string) {
    return {
      data: await this.analyticsService.getRequestActivity(id),
      message: "Request activity retrieved successfully",
    };
  }
}
