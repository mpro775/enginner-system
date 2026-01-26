import api from "./api";
import { ApiResponse, MaintenanceType, RequestStatus } from "@/types";

export interface ReportFilter {
  fromDate?: string;
  toDate?: string;
  engineerId?: string;
  consultantId?: string;
  locationId?: string;
  departmentId?: string;
  systemId?: string;
  maintenanceType?: MaintenanceType;
  status?: RequestStatus;
  format?: "json" | "excel" | "pdf";
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
  openedAt: string;
  closedAt: string | null;
  createdAt: string;
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
};
