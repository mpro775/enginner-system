import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { ReportsService } from "./reports.service";
import { ReportFilterDto } from "./dto/report-filter.dto";
import { BulkExportSelectedDto } from "./dto/bulk-export-selected.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "../../common/enums";
import {
  CurrentUser,
  CurrentUserData,
} from "../../common/decorators/current-user.decorator";
import { ForbiddenAccessException } from "../../common/exceptions";

@Controller("reports")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.CONSULTANT, Role.MAINTENANCE_MANAGER, Role.ENGINEER, Role.PROJECT_MANAGER)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("config")
  getReportsConfig() {
    return {
      data: this.reportsService.getReportsConfig(),
      message: "Reports config retrieved successfully",
    };
  }

  @Get("requests/template")
  @Roles(Role.ADMIN)
  async getEmptyRequestTemplate(@Res() res: Response) {
    try {
      const buffer = await this.reportsService.generateEmptyRequestTemplatePdfBuffer();

      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=maintenance-request-template-${Date.now()}.pdf`,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      });

      res.end(buffer);
    } catch (error) {
      console.error("Empty Request Template Error:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to generate template" });
      }
    }
  }

  @Get("requests/:id")
  async getSingleRequestReport(
    @Param("id") id: string,
    @Res() res: Response,
    @Query("format") format?: string,
    @Query("preview") preview?: string,
    @CurrentUser() user?: CurrentUserData
  ) {
    try {
      // التحقق من أن المهندس يمكنه فقط الوصول إلى طلباته الخاصة
      if (user?.role === Role.ENGINEER) {
        const request = await this.reportsService.getSingleRequestDetails(id);
        // التحقق من أن الطلب مخصص لهذا المهندس
        // engineerId يكون populated object بعد populate
        const engineerId =
          (request.engineerId as any)?._id?.toString() ||
          (request.engineerId as any)?.id?.toString() ||
          request.engineerId?.toString();
        if (engineerId !== user.userId) {
          throw new ForbiddenAccessException(
            "ليس لديك صلاحية للوصول إلى هذا التقرير"
          );
        }
      }

      const reportFormat = format || "pdf";

      if (reportFormat === "pdf") {
        const buffer = await this.reportsService.generateSingleRequestPdfBuffer(id);
        const isPreview = preview === "true";

        res.set({
          "Content-Type": "application/pdf",
          "Content-Disposition": isPreview
            ? `inline; filename=maintenance-request-${id}.pdf`
            : `attachment; filename=maintenance-request-${id}-${Date.now()}.pdf`,
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
        if (error instanceof ForbiddenAccessException) {
          res.status(403).json({ message: error.message });
        } else {
          res.status(500).json({ message: "Failed to generate report" });
        }
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
        const errorMessage =
          error instanceof Error ? error.message : "Failed to generate report";
        const statusCode =
          typeof errorMessage === "string" &&
          errorMessage.includes("لا يمكن تصدير PDF")
            ? 413
            : 500;

        res.status(statusCode).json({ message: errorMessage });
      }
    }
  }

  @Post("requests/bulk-export")
  async bulkExportSelectedRequests(
    @Body() body: BulkExportSelectedDto,
    @Res() res: Response,
    @CurrentUser() user?: CurrentUserData
  ) {
    try {
      await this.reportsService.streamBulkRequestsZipByIds(
        body.requestIds,
        res,
        user
      );
    } catch (error) {
      console.error("Bulk Selected Export Error:", error);
      if (!res.headersSent) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to export requests";
        const statusCode =
          typeof errorMessage === "string" &&
          (errorMessage.includes("الحد الأقصى") ||
            errorMessage.includes("at least one") ||
            errorMessage.includes("No matching requests"))
            ? 400
            : 500;
        res.status(statusCode).json({ message: errorMessage });
      }
    }
  }

  @Post("requests/bulk-export/filtered")
  async bulkExportFilteredRequests(
    @Body() filter: ReportFilterDto,
    @Res() res: Response,
    @CurrentUser() user?: CurrentUserData
  ) {
    try {
      await this.reportsService.streamBulkRequestsZipByFilter(filter, res, user);
    } catch (error) {
      console.error("Bulk Filtered Export Error:", error);
      if (!res.headersSent) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to export requests";
        const statusCode =
          typeof errorMessage === "string" &&
          (errorMessage.includes("الحد الأقصى") ||
            errorMessage.includes("No matching requests"))
            ? 400
            : 500;
        res.status(statusCode).json({ message: errorMessage });
      }
    }
  }

  @Post("requests/bulk-export/jobs")
  async startBulkExportSelectedJob(
    @Body() body: BulkExportSelectedDto,
    @CurrentUser() user?: CurrentUserData
  ) {
    const job = await this.reportsService.startBulkExportJobByIds(
      body.requestIds,
      user
    );

    return {
      data: job,
      message: "Bulk export job started",
    };
  }

  @Post("requests/bulk-export/jobs/filtered")
  async startBulkExportFilteredJob(
    @Body() filter: ReportFilterDto,
    @CurrentUser() user?: CurrentUserData
  ) {
    const job = await this.reportsService.startBulkExportJobByFilter(
      filter,
      user
    );

    return {
      data: job,
      message: "Bulk export filtered job started",
    };
  }

  @Get("requests/bulk-export/jobs/:jobId")
  async getBulkExportJob(@Param("jobId") jobId: string) {
    const job = this.reportsService.getBulkExportJob(jobId);
    return {
      data: job,
      message: "Bulk export job status retrieved",
    };
  }

  @Get("requests/bulk-export/jobs/:jobId/download")
  async downloadBulkExportJob(
    @Param("jobId") jobId: string,
    @Res() res: Response
  ) {
    try {
      await this.reportsService.downloadBulkExportJob(jobId, res);
    } catch (error) {
      if (!res.headersSent) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to download export";
        const statusCode =
          errorMessage.includes("not found")
            ? 404
            : errorMessage.includes("not ready")
              ? 409
              : 400;
        res.status(statusCode).json({ message: errorMessage });
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
