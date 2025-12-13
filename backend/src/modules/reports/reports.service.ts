import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, FilterQuery } from "mongoose";
import * as ExcelJS from "exceljs";
import * as PDFDocument from "pdfkit";
import * as puppeteer from "puppeteer";
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

// Convert logo to base64 for embedding in HTML
function convertLogoToBase64(): string {
  try {
    const logoPath = path.join(
      __dirname,
      "..",
      "..",
      "assets",
      "image",
      "logo.png"
    );
    if (!fs.existsSync(logoPath)) {
      console.warn("Logo file not found at:", logoPath);
      return "";
    }

    const logoBuffer = fs.readFileSync(logoPath);
    const base64 = logoBuffer.toString("base64");
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error("Error converting logo to base64:", error);
    return "";
  }
}

// Helper function to escape HTML characters
function escapeHtml(text: string): string {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Generate HTML content for the report (summary + table)
function generateReportContent(data: RequestReportData[], stats: any): string {
  let html = "";

  // Summary section
  html += `
    <div class="content-section">
      <h2 class="section-title">ملخص الإحصائيات</h2>
      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-value">${escapeHtml(String(stats?.totalRequests || 0))}</div>
          <div class="summary-label">إجمالي الطلبات</div>
        </div>
        <div class="summary-card">
          <div class="summary-value">${escapeHtml(String(stats?.inProgress || 0))}</div>
          <div class="summary-label">قيد التنفيذ</div>
        </div>
        <div class="summary-card">
          <div class="summary-value">${escapeHtml(String(stats?.completed || 0))}</div>
          <div class="summary-label">مكتملة</div>
        </div>
        <div class="summary-card">
          <div class="summary-value">${escapeHtml(String(stats?.stopped || 0))}</div>
          <div class="summary-label">متوقفة</div>
        </div>
        <div class="summary-card">
          <div class="summary-value">${escapeHtml(String(stats?.emergencyRequests || 0))}</div>
          <div class="summary-label">طوارئ</div>
        </div>
        <div class="summary-card">
          <div class="summary-value">${escapeHtml(String(stats?.preventiveRequests || 0))}</div>
          <div class="summary-label">وقائية</div>
        </div>
        <div class="summary-card">
          <div class="summary-value">${escapeHtml(String(stats?.avgCompletionTimeHours || 0))}</div>
          <div class="summary-label">متوسط وقت الإنجاز (ساعة)</div>
        </div>
      </div>
    </div>
  `;

  // Table section
  html += `
    <div class="content-section">
      <h2 class="section-title">تفاصيل الطلبات</h2>
      <table class="data-table">
        <thead>
          <tr>
            <th>التاريخ</th>
            <th>الموقع</th>
            <th>الحالة</th>
            <th>النوع</th>
            <th>المهندس</th>
            <th>الكود</th>
          </tr>
        </thead>
        <tbody>
  `;

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

  // Add table rows (limit to 30 rows for performance)
  const limitedData = data.slice(0, 30);
  limitedData.forEach((row) => {
    const statusKey = String(row.status || "")
      .toLowerCase()
      .replace(/_/g, "_");
    const statusText = statusMap[statusKey] || row.status || "N/A";

    const typeKey = String(row.maintenanceType || "").toLowerCase();
    const typeText = typeMap[typeKey] || row.maintenanceType || "N/A";

    const openedDate = row.openedAt
      ? new Date(row.openedAt).toLocaleDateString("ar-SA")
      : "N/A";

    html += `
      <tr>
        <td>${escapeHtml(openedDate)}</td>
        <td>${escapeHtml(row.locationName || "N/A")}</td>
        <td>${escapeHtml(statusText)}</td>
        <td>${escapeHtml(typeText)}</td>
        <td>${escapeHtml(row.engineerName || "N/A")}</td>
        <td>${escapeHtml(row.requestCode || "N/A")}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
  `;

  if (data.length > 30) {
    html += `<p style="text-align: center; margin-top: 10px;">... و ${data.length - 30} طلبات أخرى</p>`;
  }

  html += `
    </div>
  `;

  return html;
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

  async generatePdfBuffer(filter: ReportFilterDto): Promise<Buffer> {
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

    // 1. تجهيز الصور والبيانات
    const logoBase64 = convertLogoToBase64();
    const reportNumber = `REP-${Date.now().toString().slice(-6)}`;
    const reportDate = new Date().toLocaleDateString("ar-SA");
    const reportContent = generateReportContent(data, stats);

    // 2. تصميم الهيدر (HTML + CSS مدمج)
    // قمنا بتقليل margin و line-height لحل مشكلة التباعد
    // كبرنا الشعار إلى 100px
    const headerTemplate = `
    <div style="font-family: 'Tajawal', sans-serif; width: 100%; font-size: 10px; padding: 0 40px; display: flex; justify-content: space-between; align-items: flex-start; direction: rtl; border-bottom: 2px solid #0f5b7a; padding-bottom: 5px;">
        
        <div style="text-align: right; width: 30%;">
            <p style="margin: 2px 0; font-weight: bold; color: #0f5b7a;">المملكة العربية السعودية</p>
            <p style="margin: 2px 0; font-weight: bold; color: #0f5b7a;">جامعة الملك سعود</p>
            <p style="margin: 2px 0;">إدارة التشغيل والصيانة</p>
            <p style="margin: 2px 0;">بكليات الجامعة - فرع المزاحمية</p>
        </div>

        <div style="text-align: center; width: 30%;">
            <p style="margin: 0 0 5px 0; font-size: 12px; color: #0f5b7a;">بسم الله الرحمن الرحيم</p>
            <img src="${logoBase64}" style="width: 100px; height: auto;" />
        </div>

        <div style="text-align: left; width: 30%; padding-top: 15px; direction: ltr;">
            <p style="margin: 2px 0;"><strong>Report No:</strong> ${reportNumber}</p>
            <p style="margin: 2px 0;"><strong>Date:</strong> ${reportDate}</p>
        </div>
    </div>`;

    // 3. تصميم الفوتر (HTML + CSS مدمج)
    // استخدمنا Flexbox لتوزيع العناصر الـ 4 بالتساوي
    const footerTemplate = `
    <div style="font-family: 'Tajawal', sans-serif; width: 100%; font-size: 8px; padding: 0 40px; border-top: 1px solid #ccc; display: flex; justify-content: space-between; align-items: center; direction: rtl;">
        
        <div style="text-align: right;">
            <p style="margin: 1px 0;">المملكة العربية السعودية</p>
            <p style="margin: 1px 0;">ص.ب 2454 الرياض 11451</p>
        </div>

        <div style="text-align: center;">
            <p style="margin: 1px 0;">العنوان الوطني</p>
            <p style="margin: 1px 0;">RGSA8707</p>
        </div>

        <div style="text-align: center;">
             <p style="margin: 1px 0;">هاتف +966 11 4686275</p>
        </div>

        <div style="text-align: left; direction: ltr;">
            <p style="margin: 1px 0;">www.ksu.edu.sa</p>
            <p style="margin: 1px 0;">hm@ksu.edu.sa</p>
        </div>
    </div>`;

    // Read HTML template (المحتوى فقط بدون هيدر وفوتر)
    const templatePath = path.join(
      __dirname,
      "templates",
      "report-template.html"
    );
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found at: ${templatePath}`);
    }
    let htmlContent = fs.readFileSync(templatePath, "utf-8");
    htmlContent = htmlContent.replace(/{{{report_content}}}/g, reportContent);

    // إعدادات المتصفح المحسنة للدوكر
    const browser = await puppeteer.launch({
      headless: true,
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),

      // 1. أهم نقطة: إلغاء طباعة مدخلات ومخرجات كروم في الكونسول
      dumpio: false,

      // 2. إخفاء أخطاء DBus المزعجة
      env: {
        ...process.env,
        // هذه تخدع المتصفح وتخبره أن عنوان الاتصال هو "لا شيء" فيتوقف عن البحث
        DBUS_SESSION_BUS_ADDRESS: "autolaunch:",
      },

      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage", // ضروري جداً في الدوكر
        "--disable-gpu",
        "--font-render-hinting=none", // تحسين ظهور الخطوط
        "--disable-web-security", // للسماح بتحميل الصور المحلية

        // --- إضافات لمنع أخطاء Vulkan/GL ---
        "--disable-software-rasterizer", // يمنع محاولة الرسم البرمجي للجرافيكس
        "--disable-gl-drawing-for-tests",
        "--use-gl=swiftshader", // يجبره على استخدام render برمجي خفيف جداً
        "--mute-audio", // كتم الصوت (يقلل أخطاء Audio Service)
        "--no-first-run",
        "--disable-extensions",
      ],
    });

    try {
      const page = await browser.newPage();

      // ضبط المتصفح ليعرض محتوى الطباعة
      await page.emulateMediaType("print");

      // هنا نمرر فقط المحتوى (الجدول) بدون هيدر وفوتر
      await page.setContent(htmlContent, {
        waitUntil: ["load", "networkidle0"], // انتظر حتى تحميل كل شيء بما فيه الصور
        timeout: 60000, // زيادة الوقت لـ 60 ثانية احتياطاً
      });

      // 4. التوليد مع الهيدر والفوتر الأصليين (Native)
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        displayHeaderFooter: true, // تفعيل الخاصية
        headerTemplate: headerTemplate, // تمرير الهيدر
        footerTemplate: footerTemplate, // تمرير الفوتر
        margin: {
          top: "160px", // مساحة كافية للهيدر حتى لا يغطي المحتوى
          bottom: "80px", // مساحة كافية للفوتر
          right: "20px",
          left: "20px",
        },
      });

      // Verify PDF buffer is valid
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error("Generated PDF buffer is empty or invalid");
      }

      // Check if buffer starts with PDF header
      const pdfHeader = String.fromCharCode(
        pdfBuffer[0],
        pdfBuffer[1],
        pdfBuffer[2],
        pdfBuffer[3]
      );
      if (pdfHeader !== "%PDF") {
        console.error("Invalid PDF format, header:", pdfHeader);
        throw new Error("Generated PDF is not in valid PDF format");
      }

      return Buffer.from(pdfBuffer);
    } catch (e) {
      console.error("Puppeteer Error:", e);
      throw e;
    } finally {
      // ضمان إغلاق المتصفح دائماً
      if (browser) await browser.close();
    }
  }

  async generatePdfReport(
    filter: ReportFilterDto,
    res: Response
  ): Promise<void> {
    try {
      const pdfBuffer = await this.generatePdfBuffer(filter);

      // Set response headers
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=maintenance-report-${Date.now()}.pdf`
      );

      console.log("Sending PDF response...");
      // Send PDF buffer
      res.send(pdfBuffer);
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
