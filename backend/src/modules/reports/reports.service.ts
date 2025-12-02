import { Injectable, StreamableFile } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import { Response } from 'express';
import {
  MaintenanceRequest,
  MaintenanceRequestDocument,
} from '../maintenance-requests/schemas/maintenance-request.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { ReportFilterDto } from './dto/report-filter.dto';
import { StatisticsService } from '../statistics/statistics.service';

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
    private statisticsService: StatisticsService,
  ) {}

  async getRequestsReport(filter: ReportFilterDto): Promise<RequestReportData[]> {
    const matchStage = this.buildMatchStage(filter);

    const requests = await this.requestModel
      .find(matchStage)
      .populate('engineerId', 'name')
      .populate('consultantId', 'name')
      .populate('locationId', 'name')
      .populate('departmentId', 'name')
      .populate('systemId', 'name')
      .populate('machineId', 'name')
      .sort({ createdAt: -1 });

    return requests.map((req) => ({
      requestCode: req.requestCode,
      engineerName: (req.engineerId as any)?.name || 'N/A',
      consultantName: (req.consultantId as any)?.name || null,
      maintenanceType: req.maintenanceType,
      status: req.status,
      locationName: (req.locationId as any)?.name || 'N/A',
      departmentName: (req.departmentId as any)?.name || 'N/A',
      systemName: (req.systemId as any)?.name || 'N/A',
      machineName: (req.machineId as any)?.name || 'N/A',
      machineNumber: req.machineNumber || null,
      reasonText: req.reasonText,
      engineerNotes: req.engineerNotes || null,
      consultantNotes: req.consultantNotes || null,
      openedAt: req.openedAt,
      closedAt: req.closedAt || null,
      createdAt: (req as any).createdAt,
    }));
  }

  async generateExcelReport(filter: ReportFilterDto, res: Response): Promise<void> {
    const data = await this.getRequestsReport(filter);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Maintenance System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Maintenance Requests');

    // Define columns
    sheet.columns = [
      { header: 'Request Code', key: 'requestCode', width: 18 },
      { header: 'Engineer', key: 'engineerName', width: 20 },
      { header: 'Consultant', key: 'consultantName', width: 20 },
      { header: 'Type', key: 'maintenanceType', width: 12 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Location', key: 'locationName', width: 20 },
      { header: 'Department', key: 'departmentName', width: 15 },
      { header: 'System', key: 'systemName', width: 15 },
      { header: 'Machine', key: 'machineName', width: 15 },
      { header: 'Machine No.', key: 'machineNumber', width: 12 },
      { header: 'Reason', key: 'reasonText', width: 30 },
      { header: 'Engineer Notes', key: 'engineerNotes', width: 25 },
      { header: 'Consultant Notes', key: 'consultantNotes', width: 25 },
      { header: 'Opened At', key: 'openedAt', width: 18 },
      { header: 'Closed At', key: 'closedAt', width: 18 },
    ];

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    headerRow.alignment = { horizontal: 'center' };

    // Add data rows
    data.forEach((row) => {
      sheet.addRow({
        ...row,
        openedAt: row.openedAt ? new Date(row.openedAt).toLocaleString() : '',
        closedAt: row.closedAt ? new Date(row.closedAt).toLocaleString() : '',
        consultantName: row.consultantName || '-',
        machineNumber: row.machineNumber || '-',
        engineerNotes: row.engineerNotes || '-',
        consultantNotes: row.consultantNotes || '-',
      });
    });

    // Auto-filter
    sheet.autoFilter = {
      from: 'A1',
      to: `O${data.length + 1}`,
    };

    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=maintenance-report-${Date.now()}.xlsx`,
    );

    await workbook.xlsx.write(res);
  }

  async generatePdfReport(filter: ReportFilterDto, res: Response): Promise<void> {
    const data = await this.getRequestsReport(filter);
    const stats = await this.statisticsService.getDashboardStatistics(
      filter,
      'admin',
    );

    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=maintenance-report-${Date.now()}.pdf`,
    );

    doc.pipe(res);

    // Title
    doc
      .fontSize(20)
      .text('Maintenance Requests Report', { align: 'center' })
      .moveDown();

    // Date range
    const fromDate = filter.fromDate || 'All time';
    const toDate = filter.toDate || 'Present';
    doc
      .fontSize(12)
      .text(`Period: ${fromDate} to ${toDate}`, { align: 'center' })
      .moveDown(2);

    // Summary statistics
    doc.fontSize(14).text('Summary Statistics', { underline: true }).moveDown();
    doc.fontSize(10);
    doc.text(`Total Requests: ${stats.totalRequests}`);
    doc.text(`In Progress: ${stats.inProgress}`);
    doc.text(`Completed: ${stats.completed}`);
    doc.text(`Stopped: ${stats.stopped}`);
    doc.text(`Emergency: ${stats.emergencyRequests}`);
    doc.text(`Preventive: ${stats.preventiveRequests}`);
    doc.text(`Avg. Completion Time: ${stats.avgCompletionTimeHours} hours`);
    doc.moveDown(2);

    // Requests table
    doc.fontSize(14).text('Request Details', { underline: true }).moveDown();

    // Table headers
    const tableTop = doc.y;
    const headers = ['Code', 'Engineer', 'Type', 'Status', 'Location', 'Date'];
    const colWidths = [70, 90, 60, 70, 90, 70];
    let x = 50;

    doc.fontSize(9).font('Helvetica-Bold');
    headers.forEach((header, i) => {
      doc.text(header, x, tableTop, { width: colWidths[i] });
      x += colWidths[i];
    });

    doc.font('Helvetica').fontSize(8);
    let y = tableTop + 20;

    data.slice(0, 30).forEach((row) => {
      if (y > 750) {
        doc.addPage();
        y = 50;
      }

      x = 50;
      const rowData = [
        row.requestCode,
        row.engineerName,
        row.maintenanceType,
        row.status.replace('_', ' '),
        row.locationName,
        new Date(row.openedAt).toLocaleDateString(),
      ];

      rowData.forEach((cell, i) => {
        doc.text(cell, x, y, { width: colWidths[i] - 5 });
        x += colWidths[i];
      });

      y += 15;
    });

    if (data.length > 30) {
      doc.moveDown();
      doc.text(`... and ${data.length - 30} more requests`, { align: 'center' });
    }

    // Footer
    doc
      .fontSize(8)
      .text(
        `Generated on ${new Date().toLocaleString()}`,
        50,
        doc.page.height - 50,
        { align: 'center' },
      );

    doc.end();
  }

  async getEngineerReport(
    engineerId: string,
    filter: ReportFilterDto,
  ): Promise<{
    engineer: { id: string; name: string; email: string };
    statistics: any;
    requests: RequestReportData[];
  }> {
    const engineer = await this.userModel.findById(engineerId).select('name email');

    if (!engineer) {
      throw new Error('Engineer not found');
    }

    const engineerFilter = { ...filter, engineerId };
    const [requests, statistics] = await Promise.all([
      this.getRequestsReport(engineerFilter),
      this.statisticsService.getDashboardStatistics(engineerFilter, 'admin'),
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
    const [overview, byStatus, byType, byLocation, byDepartment, topFailingMachines] =
      await Promise.all([
        this.statisticsService.getDashboardStatistics(filter, 'admin'),
        this.statisticsService.getByStatus(filter),
        this.statisticsService.getByMaintenanceType(filter),
        this.statisticsService.getByLocation(filter),
        this.statisticsService.getByDepartment(filter),
        this.statisticsService.getTopFailingMachines(filter, 5),
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

  private buildMatchStage(filter: ReportFilterDto): FilterQuery<MaintenanceRequestDocument> {
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



