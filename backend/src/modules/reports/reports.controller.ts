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

  @Get("requests/:id")
  async getSingleRequestReport(
    @Param("id") id: string,
    @Res() res: Response,
    @Query("format") format?: string
  ) {
    try {
      const reportFormat = format || "pdf";

      if (reportFormat === "pdf") {
        const buffer = await this.reportsService.generateSingleRequestPdfBuffer(id);

        res.set({
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename=maintenance-request-${id}-${Date.now()}.pdf`,
          "Content-Length": buffer.length.toString(),
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        });

        res.end(buffer);
        return;
      }

      // JSON Response
      const request = await this.reportsService.getSingleRequestDetails(id);
      res.json({
        success: true,
        statusCode: 200,
        message: "Request details retrieved successfully",
        data: request,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Single Request Report Error:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to generate report" });
      }
    }
  }

  @Get("requests")
  async getRequestsReport(
    @Query() filter: ReportFilterDto,
    @Res() res: Response // لاحظ: أزلنا passthrough: true للتحكم الكامل
  ) {
    try {
      if (filter.format === "excel") {
        await this.reportsService.generateExcelReport(filter, res);
        return; // ExcelJS يغلق الرد بنفسه
      }

      if (filter.format === "pdf") {
        const buffer = await this.reportsService.generatePdfBuffer(filter);

        res.set({
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename=maintenance-report-${Date.now()}.pdf`,
          "Content-Length": buffer.length.toString(),
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        });

        // إرسال البفر مباشرة وإغلاق الاتصال
        res.end(buffer);
        return;
      }

      // JSON Response
      const data = await this.reportsService.getRequestsReport(filter);
      res.json({
        success: true,
        statusCode: 200,
        message: "Requests report generated successfully",
        data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Report Generation Error:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to generate report" });
      }
    }
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
