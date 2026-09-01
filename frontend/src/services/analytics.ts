import api from "./api";
import { ApiResponse, TaskStatus } from "@/types";

export interface AnalyticsFilters {
  fromDate?: string;
  toDate?: string;
  locationId?: string;
  departmentId?: string;
  systemId?: string;
  machineId?: string;
  engineerId?: string;
  comparisonPreset?: "custom" | "month_to_date" | "year_to_date";
}

export interface AnalyticsPeriod {
  from: string;
  toExclusive: string;
  previousFrom: string;
  previousToExclusive: string;
  comparisonMode:
    | "previous_equal_period"
    | "previous_month_to_date"
    | "previous_year_to_date";
}

export interface PeriodComparison {
  current: number;
  previous: number;
  absoluteChange: number;
  percentChange: number | null;
  comparable: boolean;
}

export interface AgingAnalytics {
  totalOpen: number;
  buckets: {
    under4Hours: number;
    fourTo24Hours: number;
    oneTo3Days: number;
    threeDaysOrMore: number;
  };
  oldestOpenRequests: Array<{
    id: string;
    requestCode: string;
    openedAt: string;
    stoppedAt?: string;
    stopReason?: string;
    ageHours: number;
    openedAgeHours: number;
    status: string;
    machine: string;
    location: string;
  }>;
}

export interface TrendPoint {
  period: string;
  total: number;
  emergency: number;
  preventive: number;
  completed: number;
}

export interface RankingPoint {
  id: string;
  name: string;
  count: number;
}

export interface DayHourPoint {
  dayOfWeek: number;
  hour: number;
  count: number;
}

export interface LocationSystemPoint {
  locationId: string;
  locationName: string;
  systemId: string;
  systemName: string;
  count: number;
}

export interface PreventiveSummary {
  scheduled: number;
  scheduledDue: number;
  completed: number;
  overdue: number;
  cancelled: number;
  compliancePercent: number | null;
}

export interface PreventiveCalendarItem {
  id: string;
  taskCode: string;
  title: string;
  date: string;
  status: TaskStatus;
  engineer: string | null;
  location: string;
  department: string;
  system: string;
  machine: string;
}

export interface MachineProfile {
  machine: {
    id: string;
    name: string;
    description?: string;
    system: string;
    department: string | null;
    location: string | null;
    components: string[];
  };
  health: {
    totalMaintenance: number;
    emergencyMaintenance: number;
    preventiveMaintenance: number;
    lastMaintenanceAt: string | null;
    avgCompletionTimeHours: number;
    failuresLast30Days: number;
    failuresLast90Days: number;
  };
  timeline: Array<{
    id: string;
    requestCode: string;
    maintenanceType: string;
    status: string;
    openedAt: string;
    closedAt?: string;
    stoppedAt?: string;
    engineerName: string | null;
    reasonSummary: string;
  }>;
  timelineMeta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  timezone: string;
}

export interface RepeatFailureResult {
  days: number;
  timezone: string;
  currentFrom: string;
  currentToExclusive: string;
  previousFrom: string;
  previousToExclusive: string;
  machines: Array<{
    machineId: string;
    machineName: string;
    systemName: string;
    currentCount: number;
    previousCount: number;
    absoluteChange: number;
    percentChange: number | null;
    lastFailureAt: string;
  }>;
}

export interface RequestActivityItem {
  id: string;
  action: string;
  actorName: string | null;
  createdAt: string;
  summary: string;
  relevantChanges: {
    status?: string;
    maintenanceType?: string;
    noteType?: "consultant" | "health_safety" | "project_manager";
    stopReason?: string;
  };
}

export interface OperationsDashboard {
  timezone: string;
  period: AnalyticsPeriod;
  totalRequests: number;
  openRequests: number;
  emergencyOpen: number;
  stoppedRequests: number;
  pendingConsultantApproval: number;
  overduePreventive: number;
  upcomingPreventive7Days: number;
  unresolvedComplaints: number;
  repeatFailureMachines: number;
  avgCompletionTimeHours: number;
  preventiveCompliance: number | null;
  aging: AgingAnalytics["buckets"];
  trends: TrendPoint[];
  statusDistribution: Array<{ key: string; count: number }>;
  typeDistribution: Array<{ key: string; count: number }>;
  topRecurringFailures: Array<{
    machineId: string;
    machineName: string;
    systemName: string;
    failureCount: number;
    lastFailure: string;
  }>;
  comparisons: {
    totalRequests: PeriodComparison;
    emergencyRequests: PeriodComparison;
    avgCompletionTime: PeriodComparison;
    preventiveCompliance: PeriodComparison;
    repeatFailures: PeriodComparison;
  };
}

export interface AnalyticsOverview {
  timezone: string;
  period: AnalyticsPeriod;
  kpis: {
    totalRequests: number;
    openRequests: number;
    emergencyRequests: number;
    emergencyOpen: number;
    stoppedRequests: number;
    pendingConsultantApproval: number;
    completedRequests: number;
    preventiveRequests: number;
    avgCompletionTimeHours: number;
    minCompletionTimeHours: number;
    maxCompletionTimeHours: number;
    openRequestAverageAgeHours: number;
    completionRate: number;
    stopRate: number;
    emergencyPreventiveRatio: number | null;
    preventiveCompliance: number | null;
    overduePreventiveTasks: number;
  };
  preventive: PreventiveSummary;
  comparisons: OperationsDashboard["comparisons"];
  aging: AgingAnalytics;
  trends: TrendPoint[];
  rankings: {
    requestsPerEngineer: RankingPoint[];
    requestsPerDepartment: RankingPoint[];
    requestsPerLocation: RankingPoint[];
    requestsPerSystem: RankingPoint[];
    requestsPerMachine: RankingPoint[];
  };
  heatmaps: {
    dayHour: { timezone: string; dayZero: "Sunday"; points: DayHourPoint[] };
    locationSystem: LocationSystemPoint[];
  };
}

async function get<T>(path: string, filters?: AnalyticsFilters): Promise<T> {
  const response = await api.get<ApiResponse<T>>(path, { params: filters });
  return response.data.data;
}

export const analyticsService = {
  getOperationsDashboard: (filters?: AnalyticsFilters) =>
    get<OperationsDashboard>("/analytics/operations-dashboard", filters),
  getOverview: (
    filters?: AnalyticsFilters & { period?: "daily" | "weekly" | "monthly" },
  ) => get<AnalyticsOverview>("/analytics/overview", filters),
  getAging: (filters?: AnalyticsFilters) =>
    get<AgingAnalytics>("/analytics/aging", filters),
  getComparisons: (filters?: AnalyticsFilters) =>
    get<OperationsDashboard["comparisons"]>("/analytics/comparisons", filters),
  getDayHourHeatmap: (filters?: AnalyticsFilters) =>
    get<{ timezone: string; dayZero: "Sunday"; points: DayHourPoint[] }>(
      "/analytics/heatmaps/day-hour",
      filters,
    ),
  getLocationSystemHeatmap: (filters?: AnalyticsFilters) =>
    get<LocationSystemPoint[]>("/analytics/heatmaps/location-system", filters),
  getPreventiveSummary: (filters?: AnalyticsFilters) =>
    get<PreventiveSummary>("/analytics/preventive/summary", filters),
  getUpcomingPreventive: (filters?: AnalyticsFilters) =>
    get<PreventiveCalendarItem[]>("/analytics/preventive/upcoming", filters),
  getPreventiveCalendar: (filters?: AnalyticsFilters) =>
    get<PreventiveCalendarItem[]>("/analytics/preventive/calendar", filters),
  getMachineProfile: (id: string, page = 1, limit = 15) =>
    get<MachineProfile>(`/analytics/machines/${id}/profile`, {
      page,
      limit,
    } as unknown as AnalyticsFilters),
  getRepeatFailures: (
    filters?: AnalyticsFilters & { days?: number; limit?: number },
  ) => get<RepeatFailureResult>("/analytics/repeat-failures", filters),
  getRequestActivity: (id: string) =>
    get<RequestActivityItem[]>(`/analytics/requests/${id}/activity`),
};
