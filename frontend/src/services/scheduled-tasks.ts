import api from './api';
import {
  ApiResponse,
  ScheduledTask,
  PaginationMeta,
  MaintenanceType,
  TaskStatus,
} from '@/types';

interface ScheduledTasksResponse {
  data: ScheduledTask[];
  meta: PaginationMeta;
}

interface ScheduledTaskFilters {
  page?: number;
  limit?: number;
  status?: TaskStatus;
  engineerId?: string;
  locationId?: string;
  departmentId?: string;
  systemId?: string;
  machineId?: string;
  taskType?: MaintenanceType;
  scheduledMonth?: number;
  scheduledYear?: number;
}

export interface CreateScheduledTaskForm {
  title: string;
  engineerId: string;
  locationId: string;
  departmentId: string;
  systemId: string;
  machineId: string;
  maintainAllComponents?: boolean;
  selectedComponents?: string[];
  scheduledMonth: number;
  scheduledYear: number;
  taskType: MaintenanceType;
  description?: string;
}

export interface UpdateScheduledTaskForm {
  title?: string;
  engineerId?: string;
  locationId?: string;
  departmentId?: string;
  systemId?: string;
  machineId?: string;
  maintainAllComponents?: boolean;
  selectedComponents?: string[];
  scheduledMonth?: number;
  scheduledYear?: number;
  taskType?: MaintenanceType;
  description?: string;
  status?: TaskStatus;
}

export const scheduledTasksService = {
  async getAll(filters?: ScheduledTaskFilters): Promise<ScheduledTasksResponse> {
    const response = await api.get<ApiResponse<ScheduledTask[]> & { meta: PaginationMeta }>(
      '/scheduled-tasks',
      { params: filters }
    );
    return { data: response.data.data, meta: response.data.meta! };
  },

  async getPending(): Promise<ScheduledTask[]> {
    const response = await api.get<ApiResponse<ScheduledTask[]>>('/scheduled-tasks/pending');
    return response.data.data;
  },

  async getMyTasks(filters?: ScheduledTaskFilters): Promise<ScheduledTasksResponse> {
    const response = await api.get<ApiResponse<ScheduledTask[]> & { meta: PaginationMeta }>(
      '/scheduled-tasks/my-tasks',
      { params: filters }
    );
    return { data: response.data.data, meta: response.data.meta! };
  },

  async getById(id: string): Promise<ScheduledTask> {
    const response = await api.get<ApiResponse<ScheduledTask>>(`/scheduled-tasks/${id}`);
    return response.data.data;
  },

  async create(data: CreateScheduledTaskForm): Promise<ScheduledTask> {
    const response = await api.post<ApiResponse<ScheduledTask>>('/scheduled-tasks', data);
    return response.data.data;
  },

  async update(id: string, data: UpdateScheduledTaskForm): Promise<ScheduledTask> {
    const response = await api.patch<ApiResponse<ScheduledTask>>(`/scheduled-tasks/${id}`, data);
    return response.data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/scheduled-tasks/${id}`);
  },
};
