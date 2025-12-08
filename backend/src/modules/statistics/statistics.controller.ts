import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { StatisticsService } from "./statistics.service";
import {
  StatisticsFilterDto,
  TrendsFilterDto,
  TopFailingMachinesFilterDto,
} from "./dto/statistics-filter.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import {
  CurrentUser,
  CurrentUserData,
} from "../../common/decorators/current-user.decorator";
import { Role } from "../../common/enums";

@Controller("statistics")
@UseGuards(JwtAuthGuard)
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get("dashboard")
  async getDashboard(
    @Query() filter: StatisticsFilterDto,
    @CurrentUser() user: CurrentUserData
  ) {
    const stats = await this.statisticsService.getDashboardStatistics(
      filter,
      user.role,
      user.userId
    );
    return {
      data: stats,
      message: "Dashboard statistics retrieved successfully",
    };
  }

  @Get("by-engineer")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.CONSULTANT, Role.MAINTENANCE_MANAGER)
  async getByEngineer(@Query() filter: StatisticsFilterDto) {
    const stats = await this.statisticsService.getByEngineer(filter);
    return {
      data: stats,
      message: "Engineer statistics retrieved successfully",
    };
  }

  @Get("by-status")
  async getByStatus(@Query() filter: StatisticsFilterDto) {
    const stats = await this.statisticsService.getByStatus(filter);
    return {
      data: stats,
      message: "Status statistics retrieved successfully",
    };
  }

  @Get("by-maintenance-type")
  async getByMaintenanceType(@Query() filter: StatisticsFilterDto) {
    const stats = await this.statisticsService.getByMaintenanceType(filter);
    return {
      data: stats,
      message: "Maintenance type statistics retrieved successfully",
    };
  }

  @Get("by-location")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async getByLocation(@Query() filter: StatisticsFilterDto) {
    const stats = await this.statisticsService.getByLocation(filter);
    return {
      data: stats,
      message: "Location statistics retrieved successfully",
    };
  }

  @Get("by-department")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async getByDepartment(@Query() filter: StatisticsFilterDto) {
    const stats = await this.statisticsService.getByDepartment(filter);
    return {
      data: stats,
      message: "Department statistics retrieved successfully",
    };
  }

  @Get("by-system")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async getBySystem(@Query() filter: StatisticsFilterDto) {
    const stats = await this.statisticsService.getBySystem(filter);
    return {
      data: stats,
      message: "System statistics retrieved successfully",
    };
  }

  @Get("top-failing-machines")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async getTopFailingMachines(@Query() filter: TopFailingMachinesFilterDto) {
    const stats = await this.statisticsService.getTopFailingMachines(
      filter,
      filter.limit || 10
    );
    return {
      data: stats,
      message: "Top failing machines retrieved successfully",
    };
  }

  @Get("trends")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async getTrends(@Query() filter: TrendsFilterDto) {
    const stats = await this.statisticsService.getTrends(filter);
    return {
      data: stats,
      message: "Trends statistics retrieved successfully",
    };
  }

  @Get("response-time")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async getResponseTime(@Query() filter: StatisticsFilterDto) {
    const stats = await this.statisticsService.getResponseTime(filter);
    return {
      data: stats,
      message: "Response time statistics retrieved successfully",
    };
  }
}
