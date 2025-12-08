import { Controller, Get, Query, Param, UseGuards, Res } from "@nestjs/common";
import { Response } from "express";
import { ReportsService } from "./reports.service";
import { ReportFilterDto } from "./dto/report-filter.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "../../common/enums";

@Controller("reports")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.CONSULTANT, Role.MAINTENANCE_MANAGER)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("requests")
  async getRequestsReport(
    @Query() filter: ReportFilterDto,
    @Res() res: Response
  ) {
    if (filter.format === "excel" || filter.format === "pdf") {
      if (filter.format === "excel") {
        await this.reportsService.generateExcelReport(filter, res);
      } else {
        await this.reportsService.generatePdfReport(filter, res);
      }
      return;
    }

    const data = await this.reportsService.getRequestsReport(filter);
    return res.json({
      success: true,
      statusCode: 200,
      message: "Requests report generated successfully",
      data,
      timestamp: new Date().toISOString(),
    });
  }

  @Get("engineer/:id")
  async getEngineerReport(
    @Param("id") engineerId: string,
    @Query() filter: ReportFilterDto
  ) {
    const report = await this.reportsService.getEngineerReport(
      engineerId,
      filter
    );
    return {
      data: report,
      message: "Engineer report generated successfully",
    };
  }

  @Get("summary")
  @Roles(Role.ADMIN)
  async getSummaryReport(@Query() filter: ReportFilterDto) {
    const report = await this.reportsService.getSummaryReport(filter);
    return {
      data: report,
      message: "Summary report generated successfully",
    };
  }
}
