import api from './api';
import { ApiResponse, DashboardStatistics, EngineerStatistics } from '@/types';

interface StatisticsFilters {
  fromDate?: string;
  toDate?: string;
  engineerId?: string;
  locationId?: string;
  departmentId?: string;
}

interface TrendsFilters {
  fromDate?: string;
  toDate?: string;
  period?: 'daily' | 'weekly' | 'monthly';
}

interface TrendData {
  period: string;
  total: number;
  emergency: number;
  preventive: number;
  completed: number;
}

interface LocationStats {
  locationId: string;
  locationName: string;
  count: number;
}

interface DepartmentStats {
  departmentId: string;
  departmentName: string;
  count: number;
}

interface SystemStats {
  systemId: string;
  systemName: string;
  count: number;
}

interface TopFailingMachine {
  machineId: string;
  machineName: string;
  systemName: string;
  failureCount: number;
  lastFailure: string;
}

interface ResponseTimeStats {
  avgResponseTimeHours: number;
  avgCompletionTimeHours: number;
  minCompletionTimeHours: number;
  maxCompletionTimeHours: number;
}

export const statisticsService = {
  async getDashboard(filters?: StatisticsFilters): Promise<DashboardStatistics> {
    const response = await api.get<ApiResponse<DashboardStatistics>>('/statistics/dashboard', {
      params: filters,
    });
    return response.data.data;
  },

  async getByEngineer(filters?: StatisticsFilters): Promise<EngineerStatistics[]> {
    const response = await api.get<ApiResponse<EngineerStatistics[]>>('/statistics/by-engineer', {
      params: filters,
    });
    return response.data.data;
  },

  async getByStatus(filters?: StatisticsFilters): Promise<Record<string, number>> {
    const response = await api.get<ApiResponse<Record<string, number>>>('/statistics/by-status', {
      params: filters,
    });
    return response.data.data;
  },

  async getByMaintenanceType(filters?: StatisticsFilters): Promise<Record<string, number>> {
    const response = await api.get<ApiResponse<Record<string, number>>>(
      '/statistics/by-maintenance-type',
      { params: filters }
    );
    return response.data.data;
  },

  async getByLocation(filters?: StatisticsFilters): Promise<LocationStats[]> {
    const response = await api.get<ApiResponse<LocationStats[]>>('/statistics/by-location', {
      params: filters,
    });
    return response.data.data;
  },

  async getByDepartment(filters?: StatisticsFilters): Promise<DepartmentStats[]> {
    const response = await api.get<ApiResponse<DepartmentStats[]>>('/statistics/by-department', {
      params: filters,
    });
    return response.data.data;
  },

  async getBySystem(filters?: StatisticsFilters): Promise<SystemStats[]> {
    const response = await api.get<ApiResponse<SystemStats[]>>('/statistics/by-system', {
      params: filters,
    });
    return response.data.data;
  },

  async getTopFailingMachines(
    filters?: StatisticsFilters,
    limit?: number
  ): Promise<TopFailingMachine[]> {
    const response = await api.get<ApiResponse<TopFailingMachine[]>>(
      '/statistics/top-failing-machines',
      { params: { ...filters, limit } }
    );
    return response.data.data;
  },

  async getTrends(filters?: TrendsFilters): Promise<TrendData[]> {
    const response = await api.get<ApiResponse<TrendData[]>>('/statistics/trends', {
      params: filters,
    });
    return response.data.data;
  },

  async getResponseTime(filters?: StatisticsFilters): Promise<ResponseTimeStats> {
    const response = await api.get<ApiResponse<ResponseTimeStats>>('/statistics/response-time', {
      params: filters,
    });
    return response.data.data;
  },
};






