import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, FilterQuery, Types } from "mongoose";
import * as ExcelJS from "exceljs";
import * as PDFDocument from "pdfkit";
import * as puppeteer from "puppeteer";
import type { Browser } from "puppeteer";
import * as archiver from "archiver";
import { Response } from "express";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { randomUUID } from "crypto";
import {
  MaintenanceRequest,
  MaintenanceRequestDocument,
} from "../maintenance-requests/schemas/maintenance-request.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import { ReportFilterDto } from "./dto/report-filter.dto";
import { StatisticsService } from "../statistics/statistics.service";
import { EntityNotFoundException } from "../../common/exceptions/business.exception";
import { RequestStatus, MaintenanceType, Role } from "../../common/enums";
import { CurrentUserData } from "../../common/decorators/current-user.decorator";
import { NotificationsGateway } from "../notifications/notifications.gateway";

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

  // Add all filtered rows
  data.forEach((row) => {
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
          ${(request.maintenanceType === "preventive" && (request as any).scheduledTaskId?.createdBy) ? `
          <tr>
            <td style="font-weight: bold; background-color: #f8f9fa;">الاستشاري الذي أنشأ المهمة الوقائية</td>
            <td>${escapeHtml((request as any).scheduledTaskId.createdBy?.name || "-")}</td>
          </tr>
          ` : ""}
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
        </table>
      </div>

    </div>
  `;

  return html;
}

export interface RequestReportData {
  id: string;
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

export type BulkExportJobStatus = "queued" | "processing" | "completed" | "failed";

interface BulkExportJob {
  id: string;
  status: BulkExportJobStatus;
  mode: "selected" | "filtered";
  totalRequests: number;
  processedRequests: number;
  totalParts: number;
  processedParts: number;
  chunkSize: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
  filePath?: string;
  fileName?: string;
  ownerUserId?: string;
}

export interface BulkExportJobSnapshot {
  id: string;
  status: BulkExportJobStatus;
  mode: "selected" | "filtered";
  totalRequests: number;
  processedRequests: number;
  totalParts: number;
  processedParts: number;
  chunkSize: number;
  progressPercent: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  error?: string;
  downloadReady: boolean;
}

const DEFAULT_MAX_PDF_EXPORT_ROWS = 5000;
const DEFAULT_BULK_ZIP_PART_SIZE = 100;
const DEFAULT_MAX_BULK_EXPORT_REQUESTS = 2000;
const DEFAULT_BULK_JOB_RETENTION_MINUTES = 60;

function getMaxPdfExportRows(): number {
  const rawValue = process.env.REPORTS_MAX_PDF_EXPORT_ROWS;
  const parsed = Number(rawValue);

  if (!rawValue || Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_MAX_PDF_EXPORT_ROWS;
  }

  return Math.floor(parsed);
}

function getBulkZipPartSize(): number {
  const rawValue = process.env.REPORTS_BULK_ZIP_PART_SIZE;
  const parsed = Number(rawValue);

  if (!rawValue || Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_BULK_ZIP_PART_SIZE;
  }

  return Math.floor(parsed);
}

function getMaxBulkExportRequests(): number {
  const rawValue = process.env.REPORTS_MAX_BULK_EXPORT_REQUESTS;
  const parsed = Number(rawValue);

  if (!rawValue || Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_MAX_BULK_EXPORT_REQUESTS;
  }

  return Math.floor(parsed);
}

function getBulkJobRetentionMinutes(): number {
  const rawValue = process.env.REPORTS_BULK_JOB_RETENTION_MINUTES;
  const parsed = Number(rawValue);

  if (!rawValue || Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_BULK_JOB_RETENTION_MINUTES;
  }

  return Math.floor(parsed);
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-");
}

@Injectable()
export class ReportsService {
  private bulkExportJobs = new Map<string, BulkExportJob>();

  constructor(
    @InjectModel(MaintenanceRequest.name)
    private requestModel: Model<MaintenanceRequestDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private statisticsService: StatisticsService,
    private notificationsGateway: NotificationsGateway
  ) {
    setInterval(() => {
      void this.cleanupExpiredBulkJobs();
    }, 10 * 60 * 1000);
  }

  getReportsConfig(): {
    maxPdfExportRows: number;
    bulkZipPartSize: number;
    maxBulkExportRequests: number;
  } {
    return {
      maxPdfExportRows: getMaxPdfExportRows(),
      bulkZipPartSize: getBulkZipPartSize(),
      maxBulkExportRequests: getMaxBulkExportRequests(),
    };
  }

  private toBulkJobSnapshot(job: BulkExportJob): BulkExportJobSnapshot {
    const progressPercent =
      job.totalRequests > 0
        ? Math.min(
            100,
            Math.max(
              0,
              Math.round((job.processedRequests / job.totalRequests) * 100)
            )
          )
        : 0;

    return {
      id: job.id,
      status: job.status,
      mode: job.mode,
      totalRequests: job.totalRequests,
      processedRequests: job.processedRequests,
      totalParts: job.totalParts,
      processedParts: job.processedParts,
      chunkSize: job.chunkSize,
      progressPercent,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString(),
      completedAt: job.completedAt?.toISOString(),
      failedAt: job.failedAt?.toISOString(),
      error: job.error,
      downloadReady: !!job.filePath && job.status === "completed",
    };
  }

  private async cleanupExpiredBulkJobs(): Promise<void> {
    const retentionMs = getBulkJobRetentionMinutes() * 60 * 1000;
    const now = Date.now();

    for (const [jobId, job] of this.bulkExportJobs.entries()) {
      const endedAt = job.completedAt || job.failedAt;
      if (!endedAt) {
        continue;
      }

      if (now - endedAt.getTime() < retentionMs) {
        continue;
      }

      if (job.filePath) {
        try {
          await fs.promises.unlink(job.filePath);
        } catch {
          // ignore cleanup errors
        }
      }

      this.bulkExportJobs.delete(jobId);
    }
  }

  getBulkExportJob(jobId: string): BulkExportJobSnapshot {
    const job = this.bulkExportJobs.get(jobId);
    if (!job) {
      throw new Error("Bulk export job not found");
    }

    return this.toBulkJobSnapshot(job);
  }

  private emitBulkExportProgress(job: BulkExportJob): void {
    if (!job.ownerUserId) {
      return;
    }

    this.notificationsGateway.notifyBulkExportProgress(
      job.ownerUserId,
      this.toBulkJobSnapshot(job)
    );
  }

  async downloadBulkExportJob(jobId: string, res: Response): Promise<void> {
    const job = this.bulkExportJobs.get(jobId);
    if (!job) {
      throw new Error("Bulk export job not found");
    }

    if (job.status !== "completed" || !job.filePath || !job.fileName) {
      throw new Error("Bulk export file is not ready yet");
    }

    const exists = fs.existsSync(job.filePath);
    if (!exists) {
      throw new Error("Export file is missing");
    }

    const stat = await fs.promises.stat(job.filePath);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename=${job.fileName}`);
    res.setHeader("Content-Length", stat.size.toString());
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    await new Promise<void>((resolve, reject) => {
      const stream = fs.createReadStream(job.filePath as string);
      stream.on("error", reject);
      stream.on("end", resolve);
      stream.pipe(res);
    });
  }

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
      id: (req as any)._id?.toString?.() || "",
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
    const maxPdfExportRows = getMaxPdfExportRows();

    if (data.length > maxPdfExportRows) {
      throw new Error(
        `لا يمكن تصدير PDF لأكثر من ${maxPdfExportRows} طلب. يرجى تضييق الفلترة أو استخدام Excel.`
      );
    }

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

    const logoBase64 = convertLogoToBase64();
    const reportContent = generateReportContent(data, stats);
    const headerTemplate = this.getPdfHeaderTemplate(logoBase64);
    const footerTemplate = this.getPdfFooterTemplate();

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

    return this.generatePdfFromHtml(htmlContent, headerTemplate, footerTemplate);
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

  private getPdfHeaderTemplate(logoBase64: string): string {
    return `
    <div style="font-family: 'Noto Sans Arabic', 'Cairo', 'Tajawal', 'Arial', sans-serif; width: 100%; font-size: 10px; padding: 0 40px; display: flex; justify-content: space-between; align-items: center; direction: rtl; border-bottom: 2px solid #0f5b7a; padding-bottom: 5px;">
        <div style="text-align: right; width: 30%;">
            <p style="margin: 0 0 2px 0; font-size: 11px; font-weight: bold; color: #0f5b7a;">المملكة العربية السعودية</p>
            <p style="margin: 0 0 2px 0; font-size: 11px; font-weight: bold; color: #0f5b7a;">جامعة الملك سعود</p>
            <p style="margin: 0 0 2px 0; font-size: 10px; color: #0f5b7a;">نائب رئيس الجامعة للمشاريع</p>
            <p style="margin: 0; font-size: 10px; color: #0f5b7a;">الإدارة العامة للصيانة</p>
        </div>
        <div style="text-align: center; width: 40%; display: flex; justify-content: center; align-items: center;">
            <img src="${logoBase64}" style="max-width: 190px; height: auto;" />
        </div>
        <div style="text-align: left; width: 30%;">
            <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: bold; color: #0f5b7a; line-height: 1.3;">إدارة التشغيل والصيانة</p>
            <p style="margin: 0; font-size: 11px; font-weight: bold; color: #0f5b7a; line-height: 1.4;">بكليات الجامعة - فرع المزاحمية</p>
        </div>
    </div>`;
  }

  private getPdfFooterTemplate(): string {
    return `
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
  }

  private async createPuppeteerBrowser(): Promise<Browser> {
    return puppeteer.launch({
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
  }

  private async generatePdfFromHtml(
    htmlContent: string,
    headerTemplate: string,
    footerTemplate: string,
    browser?: Browser
  ): Promise<Buffer> {
    const ownedBrowser = browser || (await this.createPuppeteerBrowser());
    const shouldCloseBrowser = !browser;

    try {
      const page = await ownedBrowser.newPage();
      await page.emulateMediaType("print");

      await page.setContent(htmlContent, {
        waitUntil: ["load", "networkidle0"],
        timeout: 60000,
      });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate,
        footerTemplate,
        margin: {
          top: "140px",
          bottom: "80px",
          right: "20px",
          left: "20px",
        },
      });

      await page.close();

      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error("Generated PDF buffer is empty or invalid");
      }

      const pdfHeader = String.fromCharCode(
        pdfBuffer[0],
        pdfBuffer[1],
        pdfBuffer[2],
        pdfBuffer[3]
      );
      if (pdfHeader !== "%PDF") {
        throw new Error("Generated PDF is not in valid PDF format");
      }

      return Buffer.from(pdfBuffer);
    } finally {
      if (shouldCloseBrowser) {
        await ownedBrowser.close();
      }
    }
  }

  private buildMatchStage(
    filter: ReportFilterDto
  ): FilterQuery<MaintenanceRequestDocument> {
    const matchStage: FilterQuery<MaintenanceRequestDocument> = {};

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
        const endOfDay = new Date(filter.toDate);
        endOfDay.setHours(23, 59, 59, 999);
        matchStage.createdAt.$lte = endOfDay;
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
      .populate({
        path: "scheduledTaskId",
        populate: { path: "createdBy", select: "name email" },
      })
      .exec();

    if (!request) {
      throw new EntityNotFoundException("Maintenance Request", requestId);
    }

    return request as MaintenanceRequestDocument;
  }

  async generateSingleRequestPdfBuffer(
    requestId: string,
    browser?: Browser
  ): Promise<Buffer> {
    const request = await this.getSingleRequestDetails(requestId);
    return this.generateSingleRequestPdfBufferFromRequest(request, browser);
  }

  private async generateSingleRequestPdfBufferFromRequest(
    request: MaintenanceRequestDocument,
    browser?: Browser
  ): Promise<Buffer> {
    const logoBase64 = convertLogoToBase64();
    const reportContent = generateSingleRequestContent(request);
    const headerTemplate = this.getPdfHeaderTemplate(logoBase64);
    const footerTemplate = this.getPdfFooterTemplate();

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

    return this.generatePdfFromHtml(
      htmlContent,
      headerTemplate,
      footerTemplate,
      browser
    );
  }

  async generateEmptyRequestTemplatePdfBuffer(): Promise<Buffer> {
    const logoBase64 = convertLogoToBase64();
    const reportContent = generateEmptyRequestTemplateContent();
    const headerTemplate = this.getPdfHeaderTemplate(logoBase64);
    const footerTemplate = this.getPdfFooterTemplate();

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

    return this.generatePdfFromHtml(htmlContent, headerTemplate, footerTemplate);
  }

  private normalizeSelectedRequestIds(requestIds: string[]): string[] {
    const normalized = Array.from(
      new Set((requestIds || []).map((id) => id?.trim()))
    ).filter((id) => !!id && Types.ObjectId.isValid(id));

    if (normalized.length === 0) {
      throw new Error("Please select at least one valid request");
    }

    const maxBulkExportRequests = getMaxBulkExportRequests();
    if (normalized.length > maxBulkExportRequests) {
      throw new Error(`الحد الأقصى لتصدير الطلبات دفعة واحدة هو ${maxBulkExportRequests} طلب.`);
    }

    return normalized;
  }

  private applyUserScope(
    matchStage: FilterQuery<MaintenanceRequestDocument>,
    user?: CurrentUserData
  ): FilterQuery<MaintenanceRequestDocument> {
    if (user?.role === Role.ENGINEER && user.userId) {
      return {
        ...matchStage,
        engineerId: {
          $in: [
            user.userId,
            Types.ObjectId.isValid(user.userId)
              ? new Types.ObjectId(user.userId)
              : null,
          ].filter(Boolean),
        } as any,
      };
    }

    return matchStage;
  }

  private async getRequestsForIds(
    requestIds: string[],
    user?: CurrentUserData
  ): Promise<MaintenanceRequestDocument[]> {
    const normalizedRequestIds = this.normalizeSelectedRequestIds(requestIds);
    const baseMatchStage: FilterQuery<MaintenanceRequestDocument> = {
      _id: { $in: normalizedRequestIds.map((id) => new Types.ObjectId(id)) },
    };
    const matchStage = this.applyUserScope(baseMatchStage, user);

    const requests = await this.requestModel
      .find(matchStage)
      .populate("engineerId", "name email")
      .populate("consultantId", "name email")
      .populate("healthSafetySupervisorId", "name email")
      .populate("locationId", "name")
      .populate("departmentId", "name")
      .populate("systemId", "name")
      .populate("machineId", "name components description")
      .populate({
        path: "scheduledTaskId",
        populate: { path: "createdBy", select: "name email" },
      })
      .sort({ createdAt: -1 })
      .exec();

    if (!requests.length) {
      throw new Error("No matching requests found for export");
    }

    return requests as MaintenanceRequestDocument[];
  }

  private async getRequestsForFilter(
    filter: ReportFilterDto,
    user?: CurrentUserData
  ): Promise<MaintenanceRequestDocument[]> {
    const matchStage = this.applyUserScope(this.buildMatchStage(filter), user);
    const requests = await this.requestModel
      .find(matchStage)
      .populate("engineerId", "name email")
      .populate("consultantId", "name email")
      .populate("healthSafetySupervisorId", "name email")
      .populate("locationId", "name")
      .populate("departmentId", "name")
      .populate("systemId", "name")
      .populate("machineId", "name components description")
      .populate({
        path: "scheduledTaskId",
        populate: { path: "createdBy", select: "name email" },
      })
      .sort({ createdAt: -1 })
      .exec();

    if (!requests.length) {
      throw new Error("No matching requests found for export");
    }

    const maxBulkExportRequests = getMaxBulkExportRequests();
    if (requests.length > maxBulkExportRequests) {
      throw new Error(`الحد الأقصى لتصدير الطلبات دفعة واحدة هو ${maxBulkExportRequests} طلب.`);
    }

    return requests as MaintenanceRequestDocument[];
  }

  private async createZipBuffer(
    entries: Array<{ name: string; content: Buffer }>
  ): Promise<Buffer> {
    return new Promise<Buffer>(async (resolve, reject) => {
      const zipArchive = archiver("zip", { zlib: { level: 9 } });
      const chunks: Buffer[] = [];

      zipArchive.on("data", (chunk: Buffer) => {
        chunks.push(Buffer.from(chunk));
      });
      zipArchive.on("error", reject);
      zipArchive.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      try {
        for (const entry of entries) {
          zipArchive.append(entry.content, { name: entry.name });
        }
        await zipArchive.finalize();
      } catch (error) {
        reject(error);
      }
    });
  }

  private buildMainBundleZipName(): string {
    const date = new Date().toISOString().split("T")[0];
    return `maintenance-requests-bundle-${date}.zip`;
  }

  private buildPartZipName(index: number): string {
    return `maintenance-requests-part-${String(index).padStart(3, "0")}.zip`;
  }

  private buildPdfName(request: MaintenanceRequestDocument): string {
    const requestCode =
      request.requestCode || (request as any)?._id?.toString() || "request";
    return `${sanitizeFilename(requestCode)}.pdf`;
  }

  private getBulkExportTempDirectory(): string {
    const dir = path.join(os.tmpdir(), "maintenance-bulk-exports");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  private async appendRequestsAsPartZips(
    requests: MaintenanceRequestDocument[],
    outerArchive: any,
    onRequestProcessed?: () => void,
    onPartProcessed?: () => void
  ): Promise<void> {
    const chunkSize = getBulkZipPartSize();
    const chunks = chunkArray(requests, chunkSize);
    const browser = await this.createPuppeteerBrowser();

    try {
      for (let index = 0; index < chunks.length; index += 1) {
        const currentChunk = chunks[index];
        const partEntries: Array<{ name: string; content: Buffer }> = [];

        for (const request of currentChunk) {
          const pdfBuffer = await this.generateSingleRequestPdfBufferFromRequest(
            request,
            browser
          );
          partEntries.push({
            name: this.buildPdfName(request),
            content: pdfBuffer,
          });
          onRequestProcessed?.();
        }

        const partZipBuffer = await this.createZipBuffer(partEntries);
        outerArchive.append(partZipBuffer, {
          name: this.buildPartZipName(index + 1),
        });
        onPartProcessed?.();
      }
    } finally {
      await browser.close();
    }
  }

  private createBulkExportJob(
    mode: "selected" | "filtered",
    totalRequests: number,
    chunkSize: number,
    ownerUserId?: string
  ): BulkExportJob {
    const job: BulkExportJob = {
      id: randomUUID(),
      status: "queued",
      mode,
      totalRequests,
      processedRequests: 0,
      totalParts: Math.ceil(totalRequests / chunkSize),
      processedParts: 0,
      chunkSize,
      createdAt: new Date(),
      ownerUserId,
    };

    this.bulkExportJobs.set(job.id, job);
    return job;
  }

  private async runBulkExportJob(
    job: BulkExportJob,
    requests: MaintenanceRequestDocument[]
  ): Promise<void> {
    job.status = "processing";
    job.startedAt = new Date();
    this.emitBulkExportProgress(job);

    const fileName = this.buildMainBundleZipName();
    const filePath = path.join(
      this.getBulkExportTempDirectory(),
      `${job.id}-${fileName}`
    );

    const output = fs.createWriteStream(filePath);
    const outerArchive = archiver("zip", { zlib: { level: 9 } });
    outerArchive.pipe(output);

    try {
      await this.appendRequestsAsPartZips(
        requests,
        outerArchive,
        () => {
          job.processedRequests += 1;
          this.emitBulkExportProgress(job);
        },
        () => {
          job.processedParts += 1;
          this.emitBulkExportProgress(job);
        }
      );

      await outerArchive.finalize();
      await new Promise<void>((resolve, reject) => {
        output.on("close", () => resolve());
        output.on("error", reject);
      });

      job.status = "completed";
      job.completedAt = new Date();
      job.filePath = filePath;
      job.fileName = fileName;
      job.processedRequests = job.totalRequests;
      job.processedParts = job.totalParts;
      this.emitBulkExportProgress(job);
    } catch (error) {
      job.status = "failed";
      job.failedAt = new Date();
      job.error = error instanceof Error ? error.message : "Failed to build export";
      this.emitBulkExportProgress(job);
      if (fs.existsSync(filePath)) {
        try {
          await fs.promises.unlink(filePath);
        } catch {
          // ignore cleanup error
        }
      }
      throw error;
    }
  }

  async startBulkExportJobByIds(
    requestIds: string[],
    user?: CurrentUserData
  ): Promise<BulkExportJobSnapshot> {
    const chunkSize = getBulkZipPartSize();
    const job = this.createBulkExportJob("selected", 0, chunkSize, user?.userId);
    this.emitBulkExportProgress(job);

    void (async () => {
      try {
        const requests = await this.getRequestsForIds(requestIds, user);
        job.totalRequests = requests.length;
        job.totalParts = Math.ceil(requests.length / chunkSize);
        await this.runBulkExportJob(job, requests);
      } catch (error) {
        job.status = "failed";
        job.failedAt = new Date();
        job.error =
          error instanceof Error ? error.message : "Failed to build export";
        this.emitBulkExportProgress(job);
        console.error("Bulk export selected job failed:", error);
      }
    })();

    return this.toBulkJobSnapshot(job);
  }

  async startBulkExportJobByFilter(
    filter: ReportFilterDto,
    user?: CurrentUserData
  ): Promise<BulkExportJobSnapshot> {
    const chunkSize = getBulkZipPartSize();
    const job = this.createBulkExportJob("filtered", 0, chunkSize, user?.userId);
    this.emitBulkExportProgress(job);

    void (async () => {
      try {
        const requests = await this.getRequestsForFilter(filter, user);
        job.totalRequests = requests.length;
        job.totalParts = Math.ceil(requests.length / chunkSize);
        await this.runBulkExportJob(job, requests);
      } catch (error) {
        job.status = "failed";
        job.failedAt = new Date();
        job.error =
          error instanceof Error ? error.message : "Failed to build export";
        this.emitBulkExportProgress(job);
        console.error("Bulk export filtered job failed:", error);
      }
    })();

    return this.toBulkJobSnapshot(job);
  }

  async streamBulkRequestsZipByIds(
    requestIds: string[],
    res: Response,
    user?: CurrentUserData
  ): Promise<void> {
    const requests = await this.getRequestsForIds(requestIds, user);
    await this.streamBulkRequestsZip(requests, res);
  }

  async streamBulkRequestsZipByFilter(
    filter: ReportFilterDto,
    res: Response,
    user?: CurrentUserData
  ): Promise<void> {
    const requests = await this.getRequestsForFilter(filter, user);
    await this.streamBulkRequestsZip(requests, res);
  }

  private async streamBulkRequestsZip(
    requests: MaintenanceRequestDocument[],
    res: Response
  ): Promise<void> {
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${this.buildMainBundleZipName()}`
    );
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const outerArchive = archiver("zip", { zlib: { level: 9 } });
    outerArchive.pipe(res);

    const completed = new Promise<void>((resolve, reject) => {
      res.on("finish", () => resolve());
      res.on("error", reject);
      outerArchive.on("error", reject);
    });

    await this.appendRequestsAsPartZips(requests, outerArchive);
    await outerArchive.finalize();
    await completed;
  }
}
