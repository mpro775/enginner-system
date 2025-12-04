import { Injectable, StreamableFile } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, FilterQuery } from "mongoose";
import * as ExcelJS from "exceljs";
import * as PDFDocument from "pdfkit";
import { Response } from "express";
import * as path from "path";
import * as fs from "fs";
import {
  MaintenanceRequest,
  MaintenanceRequestDocument,
} from "../maintenance-requests/schemas/maintenance-request.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import { ReportFilterDto } from "./dto/report-filter.dto";
import { StatisticsService } from "../statistics/statistics.service";

// Arabic character ranges
const ARABIC_REGEX =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

// Arabic letter forms mapping (isolated, final, initial, medial)
const ARABIC_FORMS: Record<string, string[]> = {
  "\u0627": ["\uFE8D", "\uFE8E", "\uFE8D", "\uFE8E"], // ا alef
  "\u0628": ["\uFE8F", "\uFE90", "\uFE91", "\uFE92"], // ب ba
  "\u062A": ["\uFE95", "\uFE96", "\uFE97", "\uFE98"], // ت ta
  "\u062B": ["\uFE99", "\uFE9A", "\uFE9B", "\uFE9C"], // ث tha
  "\u062C": ["\uFE9D", "\uFE9E", "\uFE9F", "\uFEA0"], // ج jim
  "\u062D": ["\uFEA1", "\uFEA2", "\uFEA3", "\uFEA4"], // ح ha
  "\u062E": ["\uFEA5", "\uFEA6", "\uFEA7", "\uFEA8"], // خ kha
  "\u062F": ["\uFEA9", "\uFEAA", "\uFEA9", "\uFEAA"], // د dal
  "\u0630": ["\uFEAB", "\uFEAC", "\uFEAB", "\uFEAC"], // ذ dhal
  "\u0631": ["\uFEAD", "\uFEAE", "\uFEAD", "\uFEAE"], // ر ra
  "\u0632": ["\uFEAF", "\uFEB0", "\uFEAF", "\uFEB0"], // ز zay
  "\u0633": ["\uFEB1", "\uFEB2", "\uFEB3", "\uFEB4"], // س sin
  "\u0634": ["\uFEB5", "\uFEB6", "\uFEB7", "\uFEB8"], // ش shin
  "\u0635": ["\uFEB9", "\uFEBA", "\uFEBB", "\uFEBC"], // ص sad
  "\u0636": ["\uFEBD", "\uFEBE", "\uFEBF", "\uFEC0"], // ض dad
  "\u0637": ["\uFEC1", "\uFEC2", "\uFEC3", "\uFEC4"], // ط ta
  "\u0638": ["\uFEC5", "\uFEC6", "\uFEC7", "\uFEC8"], // ظ za
  "\u0639": ["\uFEC9", "\uFECA", "\uFECB", "\uFECC"], // ع ain
  "\u063A": ["\uFECD", "\uFECE", "\uFECF", "\uFED0"], // غ ghain
  "\u0641": ["\uFED1", "\uFED2", "\uFED3", "\uFED4"], // ف fa
  "\u0642": ["\uFED5", "\uFED6", "\uFED7", "\uFED8"], // ق qaf
  "\u0643": ["\uFED9", "\uFEDA", "\uFEDB", "\uFEDC"], // ك kaf
  "\u0644": ["\uFEDD", "\uFEDE", "\uFEDF", "\uFEE0"], // ل lam
  "\u0645": ["\uFEE1", "\uFEE2", "\uFEE3", "\uFEE4"], // م mim
  "\u0646": ["\uFEE5", "\uFEE6", "\uFEE7", "\uFEE8"], // ن nun
  "\u0647": ["\uFEE9", "\uFEEA", "\uFEEB", "\uFEEC"], // ه ha
  "\u0648": ["\uFEED", "\uFEEE", "\uFEED", "\uFEEE"], // و waw
  "\u064A": ["\uFEF1", "\uFEF2", "\uFEF3", "\uFEF4"], // ي ya
  "\u0649": ["\uFEEF", "\uFEF0", "\uFEEF", "\uFEF0"], // ى alef maqsura
  "\u0621": ["\uFE80", "\uFE80", "\uFE80", "\uFE80"], // ء hamza
  "\u0622": ["\uFE81", "\uFE82", "\uFE81", "\uFE82"], // آ alef madda
  "\u0623": ["\uFE83", "\uFE84", "\uFE83", "\uFE84"], // أ alef hamza above
  "\u0624": ["\uFE85", "\uFE86", "\uFE85", "\uFE86"], // ؤ waw hamza
  "\u0625": ["\uFE87", "\uFE88", "\uFE87", "\uFE88"], // إ alef hamza below
  "\u0626": ["\uFE89", "\uFE8A", "\uFE8B", "\uFE8C"], // ئ ya hamza
  "\u0629": ["\uFE93", "\uFE94", "\uFE93", "\uFE94"], // ة ta marbuta
};

// Letters that don't connect to the next letter
const NON_JOINING = new Set([
  "\u0627",
  "\u062F",
  "\u0630",
  "\u0631",
  "\u0632",
  "\u0648",
  "\u0622",
  "\u0623",
  "\u0624",
  "\u0625",
  "\u0629",
  "\u0649",
]);

// Reshape Arabic text (connect letters properly)
function reshapeArabic(text: string): string {
  if (!text) return text;

  const result: string[] = [];
  const chars = [...text];

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const forms = ARABIC_FORMS[char];

    if (!forms) {
      result.push(char);
      continue;
    }

    const prevChar = i > 0 ? chars[i - 1] : null;
    const nextChar = i < chars.length - 1 ? chars[i + 1] : null;

    const prevJoins =
      prevChar && ARABIC_FORMS[prevChar] && !NON_JOINING.has(prevChar);
    const nextJoins = nextChar && ARABIC_FORMS[nextChar];

    let formIndex: number;
    if (prevJoins && nextJoins) {
      formIndex = 3; // medial
    } else if (prevJoins) {
      formIndex = 1; // final
    } else if (nextJoins) {
      formIndex = 2; // initial
    } else {
      formIndex = 0; // isolated
    }

    result.push(forms[formIndex]);
  }

  return result.join("");
}

// Process Arabic text for PDFKit RTL rendering
function processArabicText(text: string): string {
  if (!text) return text;
  if (!ARABIC_REGEX.test(text)) return text;

  // Split text into segments (Arabic vs non-Arabic)
  const segments: Array<{ text: string; isArabic: boolean }> = [];
  let currentText = "";
  let currentIsArabic: boolean | null = null;

  for (const char of text) {
    const charIsArabic = ARABIC_REGEX.test(char) || char === " ";

    // Space handling: attach to current segment
    if (char === " " && currentText) {
      currentText += char;
      continue;
    }

    if (
      currentIsArabic !== null &&
      charIsArabic !== currentIsArabic &&
      currentText.trim()
    ) {
      segments.push({ text: currentText.trim(), isArabic: currentIsArabic });
      currentText = "";
    }

    currentText += char;
    if (char !== " ") {
      currentIsArabic = charIsArabic;
    }
  }

  if (currentText.trim() && currentIsArabic !== null) {
    segments.push({ text: currentText.trim(), isArabic: currentIsArabic });
  }

  // Process each segment
  const processedSegments = segments.map((seg) => {
    if (seg.isArabic) {
      // Reshape and reverse Arabic text
      const reshaped = reshapeArabic(seg.text);
      return [...reshaped].reverse().join("");
    }
    return seg.text;
  });

  // Reverse segment order for RTL
  return processedSegments.reverse().join(" ");
}

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

      // Register Arabic font (Cairo or Amiri as fallback)
      // Try multiple possible paths for fonts directory
      const possibleFontsDirs = [
        path.join(__dirname, "..", "..", "..", "assets", "fonts"),
        path.join(__dirname, "..", "..", "assets", "fonts"),
        path.join(process.cwd(), "dist", "assets", "fonts"),
        path.join(process.cwd(), "assets", "fonts"),
        path.join(process.cwd(), "src", "assets", "fonts"),
      ];

      // Font configurations to try (Cairo first, then Amiri)
      const fontConfigs = [
        { regular: "Cairo-Regular.ttf", bold: "Cairo-Bold.ttf", name: "Cairo" },
        { regular: "Amiri-Regular.ttf", bold: "Amiri-Bold.ttf", name: "Amiri" },
      ];

      let fontsDir = "";
      let selectedFont = null;

      // Find available fonts
      for (const dir of possibleFontsDirs) {
        for (const config of fontConfigs) {
          if (
            fs.existsSync(path.join(dir, config.regular)) &&
            fs.existsSync(path.join(dir, config.bold))
          ) {
            fontsDir = dir;
            selectedFont = config;
            break;
          }
        }
        if (selectedFont) break;
      }

      let hasArabicFont = false;
      if (fontsDir && selectedFont) {
        const arabicFontPath = path.join(fontsDir, selectedFont.regular);
        const arabicBoldFontPath = path.join(fontsDir, selectedFont.bold);
        try {
          doc.registerFont("Arabic", arabicFontPath);
          doc.registerFont("Arabic-Bold", arabicBoldFontPath);
          hasArabicFont = true;
          console.log(
            `Arabic fonts (${selectedFont.name}) registered successfully from:`,
            fontsDir
          );
        } catch (fontError) {
          console.warn("Failed to register Arabic fonts:", fontError);
        }
      } else {
        console.warn(
          "Arabic font files not found. Searched in:",
          possibleFontsDirs
        );
      }

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

      // Use Arabic font if available
      const mainFont = hasArabicFont ? "Arabic" : "Helvetica";
      const boldFont = hasArabicFont ? "Arabic-Bold" : "Helvetica-Bold";

      // Title (Arabic)
      doc
        .font(boldFont)
        .fontSize(20)
        .text(processArabicText("تقرير طلبات الصيانة"), { align: "center" })
        .moveDown();

      // Date range
      const fromDate = filter.fromDate || "جميع الفترات";
      const toDate = filter.toDate || "الآن";
      doc
        .font(mainFont)
        .fontSize(12)
        .text(processArabicText(`الفترة: من ${fromDate} إلى ${toDate}`), {
          align: "center",
        })
        .moveDown(2);

      // Summary statistics (Arabic)
      doc
        .font(boldFont)
        .fontSize(14)
        .text(processArabicText("ملخص الإحصائيات"), { align: "right" })
        .moveDown();
      doc.font(mainFont).fontSize(10);
      doc.text(
        processArabicText(`إجمالي الطلبات: ${stats?.totalRequests || 0}`),
        { align: "right" }
      );
      doc.text(processArabicText(`قيد التنفيذ: ${stats?.inProgress || 0}`), {
        align: "right",
      });
      doc.text(processArabicText(`مكتملة: ${stats?.completed || 0}`), {
        align: "right",
      });
      doc.text(processArabicText(`متوقفة: ${stats?.stopped || 0}`), {
        align: "right",
      });
      doc.text(processArabicText(`طوارئ: ${stats?.emergencyRequests || 0}`), {
        align: "right",
      });
      doc.text(processArabicText(`وقائية: ${stats?.preventiveRequests || 0}`), {
        align: "right",
      });
      doc.text(
        processArabicText(
          `متوسط وقت الإنجاز: ${stats?.avgCompletionTimeHours || 0} ساعة`
        ),
        { align: "right" }
      );
      doc.moveDown(2);

      // Requests table
      if (data && data.length > 0) {
        doc
          .font(boldFont)
          .fontSize(14)
          .text(processArabicText("تفاصيل الطلبات"), { align: "right" })
          .moveDown();

        // Table headers (Arabic - reversed for RTL)
        const tableTop = doc.y;
        const headers = [
          "التاريخ",
          "الموقع",
          "الحالة",
          "النوع",
          "المهندس",
          "الكود",
        ];
        const colWidths = [70, 90, 70, 60, 90, 70];
        let x = 50;

        doc.font(boldFont).fontSize(9);
        headers.forEach((header, i) => {
          doc.text(processArabicText(header), x, tableTop, {
            width: colWidths[i],
            align: "right",
          });
          x += colWidths[i];
        });

        doc.font(mainFont).fontSize(8);
        let y = tableTop + 25;

        // Status translation map
        const statusMap: Record<string, string> = {
          in_progress: "قيد التنفيذ",
          completed: "مكتملة",
          stopped: "متوقفة",
          pending: "معلقة",
        };

        // Maintenance type translation map
        const typeMap: Record<string, string> = {
          emergency: "طوارئ",
          preventive: "وقائية",
        };

        data.slice(0, 30).forEach((row) => {
          if (y > 750) {
            doc.addPage();
            y = 50;
          }

          x = 50;
          const statusKey = row.status
            ? String(row.status).toLowerCase().replace(/_/g, "_")
            : "";
          const statusText = statusMap[statusKey] || row.status || "N/A";

          const typeKey = row.maintenanceType
            ? String(row.maintenanceType).toLowerCase()
            : "";
          const typeText = typeMap[typeKey] || row.maintenanceType || "N/A";

          const openedDate = row.openedAt
            ? new Date(row.openedAt).toLocaleDateString("ar-SA")
            : "N/A";

          // Data in reversed order for RTL (Date, Location, Status, Type, Engineer, Code)
          const rowData = [
            openedDate,
            row.locationName || "N/A",
            statusText,
            typeText,
            row.engineerName || "N/A",
            row.requestCode || "N/A",
          ];

          rowData.forEach((cell, i) => {
            const cellText = String(cell || "N/A");
            doc.text(processArabicText(cellText), x, y, {
              width: colWidths[i] - 5,
              align: "right",
            });
            x += colWidths[i];
          });

          y += 20;
        });

        if (data.length > 30) {
          doc.moveDown();
          doc.text(processArabicText(`... و ${data.length - 30} طلبات أخرى`), {
            align: "center",
          });
        }
      } else {
        doc
          .font(mainFont)
          .fontSize(12)
          .text(processArabicText("لا توجد بيانات"), { align: "center" });
      }

      // Footer
      doc
        .font(mainFont)
        .fontSize(8)
        .text(
          processArabicText(
            `تم إنشاء التقرير في ${new Date().toLocaleString("ar-SA")}`
          ),
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
