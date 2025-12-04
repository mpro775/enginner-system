import { Injectable, StreamableFile } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, FilterQuery } from "mongoose";
import * as ExcelJS from "exceljs";
import * as PDFDocument from "pdfkit";
import { Response } from "express";
import {
  MaintenanceRequest,
  MaintenanceRequestDocument,
} from "../maintenance-requests/schemas/maintenance-request.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import { ReportFilterDto } from "./dto/report-filter.dto";
import { StatisticsService } from "../statistics/statistics.service";

export interface RequestReportData {
  requestCode: string;
  engineerName: string;
  consultantName: string | null;
  maintenanceType: string;
  status: string;
  locationName: string;
  departmentName: string;
  systemName: string;
  machineName: string;
  machineNumber: string | null;
  reasonText: string;
  engineerNotes: string | null;
  consultantNotes: string | null;
  openedAt: Date;
  closedAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(MaintenanceRequest.name)
    private requestModel: Model<MaintenanceRequestDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private statisticsService: StatisticsService
  ) {}

  async getRequestsReport(
    filter: ReportFilterDto
  ): Promise<RequestReportData[]> {
    const matchStage = this.buildMatchStage(filter);

    const requests = await this.requestModel
      .find(matchStage)
      .populate("engineerId", "name")
      .populate("consultantId", "name")
      .populate("locationId", "name")
      .populate("departmentId", "name")
      .populate("systemId", "name")
      .populate("machineId", "name")
      .sort({ createdAt: -1 });

    return requests.map((req) => ({
      requestCode: req.requestCode,
      engineerName: (req.engineerId as any)?.name || "N/A",
      consultantName: (req.consultantId as any)?.name || null,
      maintenanceType: req.maintenanceType,
      status: req.status,
      locationName: (req.locationId as any)?.name || "N/A",
      departmentName: (req.departmentId as any)?.name || "N/A",
      systemName: (req.systemId as any)?.name || "N/A",
      machineName: (req.machineId as any)?.name || "N/A",
      machineNumber: req.machineNumber || null,
      reasonText: req.reasonText,
      engineerNotes: req.engineerNotes || null,
      consultantNotes: req.consultantNotes || null,
      openedAt: req.openedAt,
      closedAt: req.closedAt || null,
      createdAt: (req as any).createdAt,
    }));
  }

  async generateExcelReport(
    filter: ReportFilterDto,
    res: Response
  ): Promise<void> {
    const data = await this.getRequestsReport(filter);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Maintenance System";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Maintenance Requests");

    // Define columns
    sheet.columns = [
      { header: "Request Code", key: "requestCode", width: 18 },
      { header: "Engineer", key: "engineerName", width: 20 },
      { header: "Consultant", key: "consultantName", width: 20 },
      { header: "Type", key: "maintenanceType", width: 12 },
      { header: "Status", key: "status", width: 15 },
      { header: "Location", key: "locationName", width: 20 },
      { header: "Department", key: "departmentName", width: 15 },
      { header: "System", key: "systemName", width: 15 },
      { header: "Machine", key: "machineName", width: 15 },
      { header: "Machine No.", key: "machineNumber", width: 12 },
      { header: "Reason", key: "reasonText", width: 30 },
      { header: "Engineer Notes", key: "engineerNotes", width: 25 },
      { header: "Consultant Notes", key: "consultantNotes", width: 25 },
      { header: "Opened At", key: "openedAt", width: 18 },
      { header: "Closed At", key: "closedAt", width: 18 },
    ];

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    headerRow.alignment = { horizontal: "center" };

    // Add data rows
    data.forEach((row) => {
      sheet.addRow({
        ...row,
        openedAt: row.openedAt ? new Date(row.openedAt).toLocaleString() : "",
        closedAt: row.closedAt ? new Date(row.closedAt).toLocaleString() : "",
        consultantName: row.consultantName || "-",
        machineNumber: row.machineNumber || "-",
        engineerNotes: row.engineerNotes || "-",
        consultantNotes: row.consultantNotes || "-",
      });
    });

    // Auto-filter
    sheet.autoFilter = {
      from: "A1",
      to: `O${data.length + 1}`,
    };

    // Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=maintenance-report-${Date.now()}.xlsx`
    );

    await workbook.xlsx.write(res);
  }

  async generatePdfReport(
    filter: ReportFilterDto,
    res: Response
  ): Promise<void> {
    try {
      const data = await this.getRequestsReport(filter);

      // Convert ReportFilterDto to StatisticsFilterDto (remove format and consultantId)
      const statsFilter = {
        fromDate: filter.fromDate,
        toDate: filter.toDate,
        engineerId: filter.engineerId,
        locationId: filter.locationId,
        departmentId: filter.departmentId,
        systemId: filter.systemId,
        maintenanceType: filter.maintenanceType,
      };

      const stats = await this.statisticsService.getDashboardStatistics(
        statsFilter as any,
        "admin"
      );

      const doc = new PDFDocument({ margin: 50, size: "A4" });

      // Handle PDF generation errors before piping
      doc.on("error", (err) => {
        console.error("PDF generation error:", err);
        if (!res.headersSent) {
          res.status(500).json({
            message: "Failed to generate PDF report",
            error: err.message,
          });
        } else {
          res.end();
        }
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=maintenance-report-${Date.now()}.pdf`
      );

      doc.pipe(res);

      // Title
      doc
        .fontSize(20)
        .text("Maintenance Requests Report", { align: "center" })
        .moveDown();

      // Date range
      const fromDate = filter.fromDate || "All time";
      const toDate = filter.toDate || "Present";
      doc
        .fontSize(12)
        .text(`Period: ${fromDate} to ${toDate}`, { align: "center" })
        .moveDown(2);

      // Summary statistics
      doc
        .fontSize(14)
        .text("Summary Statistics", { underline: true })
        .moveDown();
      doc.fontSize(10);
      doc.text(`Total Requests: ${stats?.totalRequests || 0}`);
      doc.text(`In Progress: ${stats?.inProgress || 0}`);
      doc.text(`Completed: ${stats?.completed || 0}`);
      doc.text(`Stopped: ${stats?.stopped || 0}`);
      doc.text(`Emergency: ${stats?.emergencyRequests || 0}`);
      doc.text(`Preventive: ${stats?.preventiveRequests || 0}`);
      doc.text(
        `Avg. Completion Time: ${stats?.avgCompletionTimeHours || 0} hours`
      );
      doc.moveDown(2);

      // Requests table
      if (data && data.length > 0) {
        doc
          .fontSize(14)
          .text("Request Details", { underline: true })
          .moveDown();

        // Table headers
        const tableTop = doc.y;
        const headers = [
          "Code",
          "Engineer",
          "Type",
          "Status",
          "Location",
          "Date",
        ];
        const colWidths = [70, 90, 60, 70, 90, 70];
        let x = 50;

        doc.fontSize(9).font("Helvetica-Bold");
        headers.forEach((header, i) => {
          doc.text(header, x, tableTop, { width: colWidths[i] });
          x += colWidths[i];
        });

        doc.font("Helvetica").fontSize(8);
        let y = tableTop + 20;

        data.slice(0, 30).forEach((row) => {
          if (y > 750) {
            doc.addPage();
            y = 50;
          }

          x = 50;
          const statusText = row.status
            ? String(row.status).replace(/_/g, " ")
            : "N/A";
          const openedDate = row.openedAt
            ? new Date(row.openedAt).toLocaleDateString()
            : "N/A";

          const rowData = [
            row.requestCode || "N/A",
            row.engineerName || "N/A",
            row.maintenanceType || "N/A",
            statusText,
            row.locationName || "N/A",
            openedDate,
          ];

          rowData.forEach((cell, i) => {
            const cellText = String(cell || "N/A");
            doc.text(cellText, x, y, { width: colWidths[i] - 5 });
            x += colWidths[i];
          });

          y += 15;
        });

        if (data.length > 30) {
          doc.moveDown();
          doc.text(`... and ${data.length - 30} more requests`, {
            align: "center",
          });
        }
      } else {
        doc.fontSize(12).text("No data available", { align: "center" });
      }

      // Footer
      doc
        .fontSize(8)
        .text(
          `Generated on ${new Date().toLocaleString()}`,
          50,
          doc.page.height - 50,
          { align: "center" }
        );

      doc.end();
    } catch (error) {
      console.error("Error generating PDF report:", error);
      if (!res.headersSent) {
        res.status(500).json({
          message: "Failed to generate PDF report",
          error: error instanceof Error ? error.message : String(error),
        });
      } else {
        // If headers are sent, we can't send JSON, so end the response
        res.end();
      }
    }
  }

  async getEngineerReport(
    engineerId: string,
    filter: ReportFilterDto
  ): Promise<{
    engineer: { id: string; name: string; email: string };
    statistics: any;
    requests: RequestReportData[];
  }> {
    const engineer = await this.userModel
      .findById(engineerId)
      .select("name email");

    if (!engineer) {
      throw new Error("Engineer not found");
    }

    const engineerFilter = { ...filter, engineerId };
    const statsFilter = {
      fromDate: filter.fromDate,
      toDate: filter.toDate,
      engineerId: engineerId,
      locationId: filter.locationId,
      departmentId: filter.departmentId,
      systemId: filter.systemId,
      maintenanceType: filter.maintenanceType,
    };

    const [requests, statistics] = await Promise.all([
      this.getRequestsReport(engineerFilter),
      this.statisticsService.getDashboardStatistics(
        statsFilter as any,
        "admin"
      ),
    ]);

    return {
      engineer: {
        id: engineer._id.toString(),
        name: engineer.name,
        email: engineer.email,
      },
      statistics,
      requests,
    };
  }

  async getSummaryReport(filter: ReportFilterDto): Promise<{
    overview: any;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    byLocation: any[];
    byDepartment: any[];
    topFailingMachines: any[];
  }> {
    // Convert ReportFilterDto to StatisticsFilterDto
    const statsFilter = {
      fromDate: filter.fromDate,
      toDate: filter.toDate,
      engineerId: filter.engineerId,
      locationId: filter.locationId,
      departmentId: filter.departmentId,
      systemId: filter.systemId,
      maintenanceType: filter.maintenanceType,
    };

    const [
      overview,
      byStatus,
      byType,
      byLocation,
      byDepartment,
      topFailingMachines,
    ] = await Promise.all([
      this.statisticsService.getDashboardStatistics(
        statsFilter as any,
        "admin"
      ),
      this.statisticsService.getByStatus(statsFilter as any),
      this.statisticsService.getByMaintenanceType(statsFilter as any),
      this.statisticsService.getByLocation(statsFilter as any),
      this.statisticsService.getByDepartment(statsFilter as any),
      this.statisticsService.getTopFailingMachines(statsFilter as any, 5),
    ]);

    return {
      overview,
      byStatus,
      byType,
      byLocation,
      byDepartment,
      topFailingMachines,
    };
  }

  private buildMatchStage(
    filter: ReportFilterDto
  ): FilterQuery<MaintenanceRequestDocument> {
    const matchStage: FilterQuery<MaintenanceRequestDocument> = {};

    if (filter.engineerId) {
      matchStage.engineerId = filter.engineerId;
    }

    if (filter.consultantId) {
      matchStage.consultantId = filter.consultantId;
    }

    if (filter.locationId) {
      matchStage.locationId = filter.locationId;
    }

    if (filter.departmentId) {
      matchStage.departmentId = filter.departmentId;
    }

    if (filter.systemId) {
      matchStage.systemId = filter.systemId;
    }

    if (filter.maintenanceType) {
      matchStage.maintenanceType = filter.maintenanceType;
    }

    if (filter.status) {
      matchStage.status = filter.status;
    }

    if (filter.fromDate || filter.toDate) {
      matchStage.createdAt = {};
      if (filter.fromDate) {
        matchStage.createdAt.$gte = new Date(filter.fromDate);
      }
      if (filter.toDate) {
        matchStage.createdAt.$lte = new Date(filter.toDate);
      }
    }

    return matchStage;
  }
}
