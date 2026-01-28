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
import { EntityNotFoundException } from "../../common/exceptions/business.exception";
import { RequestStatus, MaintenanceType } from "../../common/enums";

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

// Convert TNC logo to base64 for embedding in HTML
function convertLogoToBase64TNC(): string {
  try {
    const logoPath = path.join(
      __dirname,
      "..",
      "..",
      "assets",
      "image",
      "logo-tnc.png"
    );
    if (!fs.existsSync(logoPath)) {
      console.warn("TNC Logo file not found at:", logoPath);
      return "";
    }

    const logoBuffer = fs.readFileSync(logoPath);
    const base64 = logoBuffer.toString("base64");
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error("Error converting TNC logo to base64:", error);
    return "";
  }
}

// Convert date to English numerals format (YYYY/MM/DD)
function formatDateEnglish(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

// Convert font file to base64 for embedding in HTML
function convertFontToBase64(fontFileName: string): string {
  try {
    const fontPath = path.join(
      __dirname,
      "..",
      "..",
      "assets",
      "fonts",
      fontFileName
    );
    if (!fs.existsSync(fontPath)) {
      console.warn("Font file not found at:", fontPath);
      return "";
    }

    const fontBuffer = fs.readFileSync(fontPath);
    const base64 = fontBuffer.toString("base64");
    const fontFormat = fontFileName.endsWith(".ttf") ? "truetype" : "opentype";
    return `data:font/${fontFormat};charset=utf-8;base64,${base64}`;
  } catch (error) {
    console.error("Error converting font to base64:", error);
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

// CSS for multi-line text (وصف الطلب، ملاحظات، إلخ) - preserves newlines/tabs as in dashboard
const MULTI_LINE_STYLE =
  "white-space: pre-wrap; word-wrap: break-word; line-height: 1.5; text-align: right; direction: rtl; vertical-align: top;";

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
            <th>سبب الطلب</th>
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
        <td style="${MULTI_LINE_STYLE}">${escapeHtml(row.reasonText || "-")}</td>
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

// Generate HTML content for single request details
function generateSingleRequestContent(request: MaintenanceRequestDocument): string {
  let html = "";

  // Status translation map
  const statusMap: Record<string, string> = {
    in_progress: "قيد التنفيذ",
    completed: "مكتملة",
    stopped: "متوقفة",
    pending: "معلقة",
  };

  // Maintenance type translation map
  const typeMap: Record<string, string> = {
    emergency: "طارئة",
    preventive: "وقائية",
  };

  const statusText = statusMap[request.status] || request.status;
  const typeText = typeMap[request.maintenanceType] || request.maintenanceType;
  
  const engineer = request.engineerId as any;
  const consultant = request.consultantId as any;
  const healthSafety = request.healthSafetySupervisorId as any;
  const location = request.locationId as any;
  const department = request.departmentId as any;
  const system = request.systemId as any;
  const machine = request.machineId as any;

  html += `
    <div class="content-section">
      <h2 class="section-title">بيانات الطلب</h2>
      
      <div style="margin-bottom: 20px;">
        <table class="data-table" style="width: 100%;">
          <tr>
            <td style="width: 200px; font-weight: bold; background-color: #f8f9fa;">كود الطلب</td>
            <td>${escapeHtml(request.requestCode)}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; background-color: #f8f9fa;">النوع</td>
            <td>${escapeHtml(typeText)}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; background-color: #f8f9fa;">تاريخ الفتح</td>
            <td>${request.openedAt ? formatDateEnglish(new Date(request.openedAt)) : "-"}</td>
          </tr>
          ${request.stoppedAt ? `
          <tr>
            <td style="font-weight: bold; background-color: #f8f9fa;">تاريخ التوقف</td>
            <td>${formatDateEnglish(new Date(request.stoppedAt))}</td>
          </tr>
          ` : ""}
        </table>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 12px; font-weight: bold; color: #0f5b7a; margin-bottom: 10px; border-bottom: 1px solid #0f5b7a; padding-bottom: 5px;">تفاصيل الطلب</h3>
        <table class="data-table" style="width: 100%;">
          <tr>
            <td style="width: 200px; font-weight: bold; background-color: #f8f9fa;">الموقع</td>
            <td>${escapeHtml(location?.name || "-")}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; background-color: #f8f9fa;">القسم</td>
            <td>${escapeHtml(department?.name || "-")}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; background-color: #f8f9fa;">الفرع</td>
            <td>${escapeHtml(system?.name || "-")}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; background-color: #f8f9fa;">البند</td>
            <td>${escapeHtml(machine?.name || "-")}</td>
          </tr>
          ${request.machineNumber ? `
          <tr>
            <td style="font-weight: bold; background-color: #f8f9fa;">رقم/توصيف البند</td>
            <td>${escapeHtml(request.machineNumber)}</td>
          </tr>
          ` : ""}
        </table>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 12px; font-weight: bold; color: #0f5b7a; margin-bottom: 10px; border-bottom: 1px solid #0f5b7a; padding-bottom: 5px;">وصف الطلب</h3>
        <div style="padding: 10px; background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; min-height: 40px; ${MULTI_LINE_STYLE}">
          ${escapeHtml(request.reasonText || "-")}
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 12px; font-weight: bold; color: #0f5b7a; margin-bottom: 10px; border-bottom: 1px solid #0f5b7a; padding-bottom: 5px;">معلومات مباشرة العمل</h3>
        <table class="data-table" style="width: 100%;">
          <tr>
            <td style="width: 200px; font-weight: bold; background-color: #f8f9fa;">المهندس المباشر للطلب</td>
            <td>${escapeHtml(engineer?.name || "-")}</td>
          </tr>
          ${request.requestNeeds ? `
          <tr>
            <td style="font-weight: bold; background-color: #f8f9fa;">احتياجات الطلب</td>
            <td style="${MULTI_LINE_STYLE}">${escapeHtml(request.requestNeeds)}</td>
          </tr>
          ` : ""}
          <tr>
            <td style="font-weight: bold; background-color: #f8f9fa;">ما تم تنفيذه</td>
            <td style="${MULTI_LINE_STYLE}">${request.implementedWork ? escapeHtml(request.implementedWork) : "لا يوجد"}</td>
          </tr>
        </table>
      </div>

      ${request.healthSafetyNotes || request.projectManagerNotes ? `
      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 12px; font-weight: bold; color: #0f5b7a; margin-bottom: 10px; border-bottom: 1px solid #0f5b7a; padding-bottom: 5px;">الملاحظات</h3>
        ${request.healthSafetyNotes ? `
        <div style="margin-bottom: 10px;">
          <strong>ملاحظات الصحة والسلامة:</strong>
          <div style="padding: 10px; background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; margin-top: 5px; ${MULTI_LINE_STYLE}">
            ${escapeHtml(request.healthSafetyNotes)}
          </div>
        </div>
        ` : ""}
        ${request.projectManagerNotes ? `
        <div style="margin-bottom: 10px;">
          <strong>ملاحظات مدير المشروع:</strong>
          <div style="padding: 10px; background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; margin-top: 5px; ${MULTI_LINE_STYLE}">
            ${escapeHtml(request.projectManagerNotes)}
          </div>
        </div>
        ` : ""}
      </div>
      ` : ""}

      ${request.stopReason ? `
      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 12px; font-weight: bold; color: #0f5b7a; margin-bottom: 10px; border-bottom: 1px solid #0f5b7a; padding-bottom: 5px;">سبب التوقف</h3>
        <div style="padding: 10px; background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; ${MULTI_LINE_STYLE}">
          ${escapeHtml(request.stopReason)}
        </div>
      </div>
      ` : ""}

      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 12px; font-weight: bold; color: #0f5b7a; margin-bottom: 10px; border-bottom: 1px solid #0f5b7a; padding-bottom: 5px;">ملاحظات الاستشاري</h3>
        <table class="data-table" style="width: 100%;">
          <tr>
            <td style="width: 200px; font-weight: bold; background-color: #f8f9fa;">المهندس الاستشاري</td>
            <td>${consultant ? escapeHtml(consultant.name || "-") : "لا يوجد"}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; background-color: #f8f9fa;">ملاحظة الاستشاري</td>
            <td style="${MULTI_LINE_STYLE}">${request.consultantNotes ? escapeHtml(request.consultantNotes) : "لا يوجد"}</td>
          </tr>
        </table>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 12px; font-weight: bold; color: #0f5b7a; margin-bottom: 10px; border-bottom: 1px solid #0f5b7a; padding-bottom: 5px;">حالة الطلب</h3>
        <table class="data-table" style="width: 100%;">
          <tr>
            <td style="width: 200px; font-weight: bold; background-color: #f8f9fa;">الحالة</td>
            <td>${escapeHtml(statusText)}</td>
          </tr>
          ${request.status === RequestStatus.COMPLETED && request.closedAt ? `
          <tr>
            <td style="font-weight: bold; background-color: #f8f9fa;">تاريخ الإغلاق</td>
            <td>${formatDateEnglish(new Date(request.closedAt))}</td>
          </tr>
          ` : ""}
        </table>
      </div>
    </div>
  `;

  return html;
}

// Generate HTML content for empty request template
function generateEmptyRequestTemplateContent(): string {
  let html = "";

  html += `
    <div class="content-section">
      <h2 class="section-title">بيانات الطلب</h2>
      
      <div style="margin-bottom: 20px;">
        <table class="data-table" style="width: 100%;">
          <tr>
            <td style="width: 200px; font-weight: bold; background-color: #f8f9fa;">كود الطلب</td>
            <td style="border-bottom: 1px dashed #ccc; min-height: 20px;">&nbsp;</td>
          </tr>
          <tr>
            <td style="font-weight: bold; background-color: #f8f9fa;">النوع</td>
            <td style="border-bottom: 1px dashed #ccc; min-height: 20px;">&nbsp;</td>
          </tr>
          <tr>
            <td style="font-weight: bold; background-color: #f8f9fa;">تاريخ الفتح</td>
            <td style="border-bottom: 1px dashed #ccc; min-height: 20px;">&nbsp;</td>
          </tr>
        </table>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 12px; font-weight: bold; color: #0f5b7a; margin-bottom: 10px; border-bottom: 1px solid #0f5b7a; padding-bottom: 5px;">تفاصيل الطلب</h3>
        <table class="data-table" style="width: 100%;">
          <tr>
            <td style="width: 200px; font-weight: bold; background-color: #f8f9fa;">الموقع</td>
            <td style="border-bottom: 1px dashed #ccc; min-height: 20px;">&nbsp;</td>
          </tr>
          <tr>
            <td style="font-weight: bold; background-color: #f8f9fa;">القسم</td>
            <td style="border-bottom: 1px dashed #ccc; min-height: 20px;">&nbsp;</td>
          </tr>
          <tr>
            <td style="font-weight: bold; background-color: #f8f9fa;">الفرع</td>
            <td style="border-bottom: 1px dashed #ccc; min-height: 20px;">&nbsp;</td>
          </tr>
          <tr>
            <td style="font-weight: bold; background-color: #f8f9fa;">البند</td>
            <td style="border-bottom: 1px dashed #ccc; min-height: 20px;">&nbsp;</td>
          </tr>
          <tr>
            <td style="font-weight: bold; background-color: #f8f9fa;">رقم/توصيف البند</td>
            <td style="border-bottom: 1px dashed #ccc; min-height: 20px;">&nbsp;</td>
          </tr>
        </table>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 12px; font-weight: bold; color: #0f5b7a; margin-bottom: 10px; border-bottom: 1px solid #0f5b7a; padding-bottom: 5px;">وصف الطلب</h3>
        <div style="padding: 10px; background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; min-height: 80px; border-bottom: 1px dashed #ccc;">
          &nbsp;
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 12px; font-weight: bold; color: #0f5b7a; margin-bottom: 10px; border-bottom: 1px solid #0f5b7a; padding-bottom: 5px;">معلومات مباشرة العمل</h3>
        <table class="data-table" style="width: 100%;">
          <tr>
            <td style="width: 200px; font-weight: bold; background-color: #f8f9fa;">المهندس المباشر للطلب</td>
            <td style="border-bottom: 1px dashed #ccc; min-height: 20px;">&nbsp;</td>
          </tr>
          <tr>
            <td style="font-weight: bold; background-color: #f8f9fa;">احتياجات الطلب</td>
            <td style="border-bottom: 1px dashed #ccc; min-height: 20px;">&nbsp;</td>
          </tr>
          <tr>
            <td style="font-weight: bold; background-color: #f8f9fa;">ما تم تنفيذه</td>
            <td style="border-bottom: 1px dashed #ccc; min-height: 20px;">&nbsp;</td>
          </tr>
          <tr>
            <td style="font-weight: bold; background-color: #f8f9fa;">معلومات الإجراء المتخذ</td>
            <td style="border-bottom: 1px dashed #ccc; min-height: 20px;">&nbsp;</td>
          </tr>
        </table>
      </div>

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
  requestNeeds: string | null;
  implementedWork: string | null;
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
      requestNeeds: req.requestNeeds || null,
      implementedWork: req.implementedWork || null,
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
      { header: "Request Needs", key: "requestNeeds", width: 25 },
      { header: "Implemented Work", key: "implementedWork", width: 25 },
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
        requestNeeds: row.requestNeeds || "-",
        implementedWork: row.implementedWork || "-",
      });
    });

    // Auto-filter
    sheet.autoFilter = {
      from: "A1",
      to: `Q${data.length + 1}`,
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
    const tncLogoBase64 = convertLogoToBase64TNC();
    const reportContent = generateReportContent(data, stats);

    // 2. تصميم الهيدر (HTML + CSS مدمج)
    const headerTemplate = `
    <div style="font-family: 'Noto Sans Arabic', 'Cairo', 'Tajawal', 'Arial', sans-serif; width: 100%; font-size: 10px; padding: 0 40px; display: flex; justify-content: space-between; align-items: center; direction: rtl; border-bottom: 2px solid #0f5b7a; padding-bottom: 5px;">
        <div style="text-align: right; width: 30%;">
            <img src="${logoBase64}" style="max-width: 150px; height: auto;" />
        </div>
        <div style="text-align: center; width: 40%;">
            <p style="margin: 0; font-size: 14px; font-weight: bold; color: #0f5b7a; line-height: 1.4;">تشغيل وصيانة ونظافة ومكافحة وتشجير مباني كليات إسكان أعضاء هيئة التدريس فرع المزاحمية</p>
        </div>
        <div style="text-align: left; width: 30%;">
            <img src="${tncLogoBase64}" style="max-width: 150px; height: auto;" />
        </div>
    </div>`;

    // 3. تصميم الفوتر (HTML + CSS مدمج)
    // استخدمنا Flexbox لتوزيع العناصر الـ 4 بالتساوي
    // استخدام خطوط النظام المتاحة في Docker
    const footerTemplate = `
    <div style="font-family: 'Noto Sans Arabic', 'Cairo', 'Tajawal', 'Arial', sans-serif; width: 100%; font-size: 8px; padding: 0 40px; border-top: 1px solid #ccc; display: flex; justify-content: space-between; align-items: center; direction: rtl;">
        
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
    const Types = require('mongoose').Types;

    if (filter.engineerId) {
      // Support both String and ObjectId formats
      matchStage.engineerId = { 
        $in: [
          filter.engineerId,
          Types.ObjectId.isValid(filter.engineerId) ? new Types.ObjectId(filter.engineerId) : null
        ].filter(Boolean)
      } as any;
    }

    if (filter.consultantId) {
      // Support both String and ObjectId formats
      matchStage.consultantId = { 
        $in: [
          filter.consultantId,
          Types.ObjectId.isValid(filter.consultantId) ? new Types.ObjectId(filter.consultantId) : null
        ].filter(Boolean)
      } as any;
    }

    if (filter.locationId) {
      // Support both String and ObjectId formats
      matchStage.locationId = { 
        $in: [
          filter.locationId,
          Types.ObjectId.isValid(filter.locationId) ? new Types.ObjectId(filter.locationId) : null
        ].filter(Boolean)
      } as any;
    }

    if (filter.departmentId) {
      // Support both String and ObjectId formats
      matchStage.departmentId = { 
        $in: [
          filter.departmentId,
          Types.ObjectId.isValid(filter.departmentId) ? new Types.ObjectId(filter.departmentId) : null
        ].filter(Boolean)
      } as any;
    }

    if (filter.systemId) {
      // Support both String and ObjectId formats
      matchStage.systemId = { 
        $in: [
          filter.systemId,
          Types.ObjectId.isValid(filter.systemId) ? new Types.ObjectId(filter.systemId) : null
        ].filter(Boolean)
      } as any;
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

  async getSingleRequestDetails(
    requestId: string
  ): Promise<MaintenanceRequestDocument> {
    const request = await this.requestModel
      .findById(requestId)
      .populate("engineerId", "name email")
      .populate("consultantId", "name email")
      .populate("healthSafetySupervisorId", "name email")
      .populate("locationId", "name")
      .populate("departmentId", "name")
      .populate("systemId", "name")
      .populate("machineId", "name components description")
      .exec();

    if (!request) {
      throw new EntityNotFoundException("Maintenance Request", requestId);
    }

    return request as MaintenanceRequestDocument;
  }

  async generateSingleRequestPdfBuffer(
    requestId: string
  ): Promise<Buffer> {
    const request = await this.getSingleRequestDetails(requestId);

    // 1. تجهيز الصور والبيانات
    const logoBase64 = convertLogoToBase64();
    const tncLogoBase64 = convertLogoToBase64TNC();
    const reportContent = generateSingleRequestContent(request);

    // 2. تصميم الهيدر (HTML + CSS مدمج)
    const headerTemplate = `
    <div style="font-family: 'Noto Sans Arabic', 'Cairo', 'Tajawal', 'Arial', sans-serif; width: 100%; font-size: 10px; padding: 0 40px; display: flex; justify-content: space-between; align-items: center; direction: rtl; border-bottom: 2px solid #0f5b7a; padding-bottom: 5px;">
        <div style="text-align: right; width: 30%;">
            <img src="${logoBase64}" style="max-width: 150px; height: auto;" />
        </div>
        <div style="text-align: center; width: 40%;">
            <p style="margin: 0; font-size: 14px; font-weight: bold; color: #0f5b7a; line-height: 1.4;">تشغيل وصيانة ونظافة ومكافحة وتشجير مباني كليات إسكان أعضاء هيئة التدريس فرع المزاحمية</p>
        </div>
        <div style="text-align: left; width: 30%;">
            <img src="${tncLogoBase64}" style="max-width: 150px; height: auto;" />
        </div>
    </div>`;

    // 3. تصميم الفوتر (HTML + CSS مدمج)
    const footerTemplate = `
    <div style="font-family: 'Noto Sans Arabic', 'Cairo', 'Tajawal', 'Arial', sans-serif; width: 100%; font-size: 8px; padding: 0 40px; border-top: 1px solid #ccc; display: flex; justify-content: space-between; align-items: center; direction: rtl;">
        
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

    // Read HTML template
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
      dumpio: false,
      env: {
        ...process.env,
        DBUS_SESSION_BUS_ADDRESS: "autolaunch:",
      },
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--font-render-hinting=none",
        "--disable-web-security",
        "--disable-software-rasterizer",
        "--disable-gl-drawing-for-tests",
        "--use-gl=swiftshader",
        "--mute-audio",
        "--no-first-run",
        "--disable-extensions",
      ],
    });

    try {
      const page = await browser.newPage();

      // ضبط المتصفح ليعرض محتوى الطباعة
      await page.emulateMediaType("print");

      await page.setContent(htmlContent, {
        waitUntil: ["load", "networkidle0"],
        timeout: 60000,
      });

      // التوليد مع الهيدر والفوتر
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: headerTemplate,
        footerTemplate: footerTemplate,
        margin: {
          top: "160px",
          bottom: "80px",
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
      if (browser) await browser.close();
    }
  }

  async generateEmptyRequestTemplatePdfBuffer(): Promise<Buffer> {
    // 1. تجهيز الصور والبيانات
    const logoBase64 = convertLogoToBase64();
    const tncLogoBase64 = convertLogoToBase64TNC();
    const reportContent = generateEmptyRequestTemplateContent();

    // 2. تصميم الهيدر (HTML + CSS مدمج)
    const headerTemplate = `
    <div style="font-family: 'Noto Sans Arabic', 'Cairo', 'Tajawal', 'Arial', sans-serif; width: 100%; font-size: 10px; padding: 0 40px; display: flex; justify-content: space-between; align-items: center; direction: rtl; border-bottom: 2px solid #0f5b7a; padding-bottom: 5px;">
        <div style="text-align: right; width: 30%;">
            <img src="${logoBase64}" style="max-width: 150px; height: auto;" />
        </div>
        <div style="text-align: center; width: 40%;">
            <p style="margin: 0; font-size: 14px; font-weight: bold; color: #0f5b7a; line-height: 1.4;">تشغيل وصيانة ونظافة ومكافحة وتشجير مباني كليات إسكان أعضاء هيئة التدريس فرع المزاحمية</p>
        </div>
        <div style="text-align: left; width: 30%;">
            <img src="${tncLogoBase64}" style="max-width: 150px; height: auto;" />
        </div>
    </div>`;

    // 3. تصميم الفوتر (HTML + CSS مدمج)
    const footerTemplate = `
    <div style="font-family: 'Noto Sans Arabic', 'Cairo', 'Tajawal', 'Arial', sans-serif; width: 100%; font-size: 8px; padding: 0 40px; border-top: 1px solid #ccc; display: flex; justify-content: space-between; align-items: center; direction: rtl;">
        
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

    // Read HTML template
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
      dumpio: false,
      env: {
        ...process.env,
        DBUS_SESSION_BUS_ADDRESS: "autolaunch:",
      },
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--font-render-hinting=none",
        "--disable-web-security",
        "--disable-software-rasterizer",
        "--disable-gl-drawing-for-tests",
        "--use-gl=swiftshader",
        "--mute-audio",
        "--no-first-run",
        "--disable-extensions",
      ],
    });

    try {
      const page = await browser.newPage();

      // ضبط المتصفح ليعرض محتوى الطباعة
      await page.emulateMediaType("print");

      await page.setContent(htmlContent, {
        waitUntil: ["load", "networkidle0"],
        timeout: 60000,
      });

      // التوليد مع الهيدر والفوتر
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: headerTemplate,
        footerTemplate: footerTemplate,
        margin: {
          top: "160px",
          bottom: "80px",
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
      if (browser) await browser.close();
    }
  }
}
