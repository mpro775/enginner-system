import api from "./api";
import {
  ApiResponse,
  MaintenanceType,
  RequestNoteType,
  RequestStatus,
} from "@/types";

export interface ReportFilter {
  fromDate?: string;
  toDate?: string;
  engineerId?: string;
  consultantId?: string;
  approvedById?: string;
  locationId?: string;
  departmentId?: string;
  systemId?: string;
  maintenanceType?: MaintenanceType;
  status?: RequestStatus;
  format?: "json" | "excel" | "pdf";
}

export interface ReportPerson {
  id: string | null;
  name: string | null;
  role: string | null;
}

export interface ReportApproval {
  status: "approved" | "pending" | "not_requested" | "approval_unknown";
  requestedAt: string | null;
  requestedBy: ReportPerson | null;
  approvedAt: string | null;
  approvedBy: ReportPerson | null;
}

export interface ReportNote {
  type: RequestNoteType;
  body: string;
  author: ReportPerson;
  createdAt: string | null;
}

export interface RequestReportData {
  request: {
    id: string;
    requestCode: string;
    maintenanceType: MaintenanceType;
    status: RequestStatus;
    locationName: string | null;
    floorName: string | null;
    detailedLocation: string | null;
    departmentName: string | null;
    systemName: string | null;
    machineName: string | null;
    machineNumber: string | null;
    reasonText: string;
    requestNeeds: string | null;
    implementedWork: string | null;
    stopReason: string | null;
    openedAt: string | null;
    closedAt: string | null;
    createdAt: string | null;
  };
  people: {
    engineer: ReportPerson | null;
    assignedConsultant: ReportPerson | null;
    healthSafetySupervisor: ReportPerson | null;
    projectManager: ReportPerson | null;
  };
  completion: ReportApproval;
  notes: ReportNote[];
}

export interface EngineerReport {
  engineer: {
    id: string;
    name: string;
    email: string;
  };
  statistics: any;
  requests: RequestReportData[];
}

export interface SummaryReport {
  overview: any;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byLocation: any[];
  byDepartment: any[];
  topFailingMachines: any[];
}

export interface ReportsConfig {
  maxPdfExportRows: number;
  bulkZipPartSize: number;
  maxBulkExportRequests: number;
}

export interface BulkExportJobSnapshot {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
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

// Helper function to remove empty/undefined values from filter
function cleanFilter(filter?: ReportFilter): ReportFilter | undefined {
  if (!filter) return undefined;
  const cleaned: ReportFilter = {};
  Object.entries(filter).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      cleaned[key as keyof ReportFilter] = value;
    }
  });
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

export const reportsService = {
  async getReportsConfig(): Promise<ReportsConfig> {
    const response = await api.get<ApiResponse<ReportsConfig>>('/reports/config');
    return response.data.data;
  },

  async getRequestsReport(filter?: ReportFilter): Promise<RequestReportData[]> {
    const cleanedFilter = cleanFilter(filter);
    const response = await api.get<ApiResponse<RequestReportData[]>>(
      "/reports/requests",
      {
        params: cleanedFilter,
      }
    );
    return response.data.data;
  },

  async downloadRequestsReport(
    filter: ReportFilter,
    format: "excel" | "pdf"
  ): Promise<void> {
    try {
      const cleanedFilter = cleanFilter({ ...filter, format });
      const response = await api.get(`/reports/requests`, {
        params: cleanedFilter,
        responseType: "blob",
      });

      // Check if response is actually a blob (not an error JSON)
      if (response.data instanceof Blob) {
        const blob = response.data;
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;

        const extension = format === "excel" ? "xlsx" : "pdf";
        const filename = `requests-report-${
          new Date().toISOString().split("T")[0]
        }.${extension}`;
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } else {
        // If response is not a blob, it might be an error JSON
        const text = await response.data.text();
        try {
          const errorData = JSON.parse(text);
          throw new Error(errorData.message || "Failed to download report");
        } catch (e) {
          throw new Error("Failed to download report: Invalid response format");
        }
      }
    } catch (error: any) {
      console.error("Error downloading report:", error);
      throw error;
    }
  },

  async getEngineerReport(
    engineerId: string,
    filter?: ReportFilter
  ): Promise<EngineerReport> {
    const cleanedFilter = cleanFilter(filter);
    const response = await api.get<ApiResponse<EngineerReport>>(
      `/reports/engineer/${engineerId}`,
      {
        params: cleanedFilter,
      }
    );
    return response.data.data;
  },

  async getSummaryReport(filter?: ReportFilter): Promise<SummaryReport> {
    const cleanedFilter = cleanFilter(filter);
    const response = await api.get<ApiResponse<SummaryReport>>(
      "/reports/summary",
      {
        params: cleanedFilter,
      }
    );
    return response.data.data;
  },

  async downloadSingleRequestReport(requestId: string): Promise<void> {
    try {
      const response = await api.get(`/reports/requests/${requestId}`, {
        params: { format: "pdf" },
        responseType: "blob",
      });

      // Check if response is actually a blob (not an error JSON)
      if (response.data instanceof Blob) {
        const blob = response.data;
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;

        const filename = `maintenance-request-${requestId}-${new Date().toISOString().split("T")[0]}.pdf`;
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } else {
        // If response is not a blob, it might be an error JSON
        const text = await response.data.text();
        try {
          const errorData = JSON.parse(text);
          throw new Error(errorData.message || "Failed to download report");
        } catch (e) {
          throw new Error("Failed to download report: Invalid response format");
        }
      }
    } catch (error: any) {
      console.error("Error downloading single request report:", error);
      throw error;
    }
  },

  async previewSingleRequestReport(requestId: string): Promise<string> {
    try {
      const response = await api.get(`/reports/requests/${requestId}`, {
        params: { format: "pdf", preview: "true" },
        responseType: "blob",
      });

      if (response.data instanceof Blob) {
        return window.URL.createObjectURL(response.data);
      } else {
        // If response is not a blob, it might be an error JSON
        const text = await response.data.text();
        try {
          const errorData = JSON.parse(text);
          throw new Error(errorData.message || "Failed to preview report");
        } catch (e) {
          throw new Error("Failed to preview report: Invalid response format");
        }
      }
    } catch (error: any) {
      console.error("Error previewing single request report:", error);
      throw error;
    }
  },

  async downloadEmptyRequestTemplate(): Promise<void> {
    try {
      const response = await api.get(`/reports/requests/template`, {
        responseType: "blob",
      });

      // Check if response is actually a blob (not an error JSON)
      if (response.data instanceof Blob) {
        const blob = response.data;
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;

        const filename = `maintenance-request-template-${new Date().toISOString().split("T")[0]}.pdf`;
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } else {
        // If response is not a blob, it might be an error JSON
        const text = await response.data.text();
        try {
          const errorData = JSON.parse(text);
          throw new Error(errorData.message || "Failed to download template");
        } catch (e) {
          throw new Error("Failed to download template: Invalid response format");
        }
      }
    } catch (error: any) {
      console.error("Error downloading empty request template:", error);
      throw error;
    }
  },

  async startBulkRequestsZipJob(requestIds: string[]): Promise<BulkExportJobSnapshot> {
    const uniqueIds = Array.from(new Set((requestIds || []).filter(Boolean)));
    if (uniqueIds.length === 0) {
      throw new Error("يرجى تحديد طلب واحد على الأقل للتصدير");
    }

    const response = await api.post<ApiResponse<BulkExportJobSnapshot>>(
      "/reports/requests/bulk-export/jobs",
      { requestIds: uniqueIds }
    );

    return response.data.data;
  },

  async startFilteredRequestsZipJob(
    filter: ReportFilter
  ): Promise<BulkExportJobSnapshot> {
    const cleanedFilter = cleanFilter(filter) || {};
    const response = await api.post<ApiResponse<BulkExportJobSnapshot>>(
      "/reports/requests/bulk-export/jobs/filtered",
      cleanedFilter
    );

    return response.data.data;
  },

  async getBulkExportJob(jobId: string): Promise<BulkExportJobSnapshot> {
    const response = await api.get<ApiResponse<BulkExportJobSnapshot>>(
      `/reports/requests/bulk-export/jobs/${jobId}`
    );

    return response.data.data;
  },

  async downloadBulkExportJob(jobId: string, onDownloadProgress?: (progressEvent: any) => void): Promise<void> {
    const response = await api.get(
      `/reports/requests/bulk-export/jobs/${jobId}/download`,
      { 
        responseType: "blob",
        onDownloadProgress
      }
    );

    const blob = response.data;
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `maintenance-requests-bundle-${new Date().toISOString().split("T")[0]}.zip`
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
