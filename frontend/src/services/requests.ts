import api from './api';
import {
  ApiResponse,
  MaintenanceRequest,
  CreateRequestForm,
  StopRequestForm,
  AddNoteForm,
  AddHealthSafetyNoteForm,
  PaginationMeta,
} from '@/types';

interface RequestsResponse {
  data: MaintenanceRequest[];
  meta: PaginationMeta;
}

interface RequestFilters {
  page?: number;
  limit?: number;
  status?: string;
  engineerId?: string;
  locationId?: string;
  departmentId?: string;
  systemId?: string;
  maintenanceType?: string;
  fromDate?: string;
  toDate?: string;
}

export const requestsService = {
  async getAll(filters?: RequestFilters): Promise<RequestsResponse> {
    const response = await api.get<ApiResponse<MaintenanceRequest[]> & { meta: PaginationMeta }>(
      '/requests',
      { params: filters }
    );
    return { data: response.data.data, meta: response.data.meta! };
  },

  async getById(id: string): Promise<MaintenanceRequest> {
    const response = await api.get<ApiResponse<MaintenanceRequest>>(`/requests/${id}`);
    return response.data.data;
  },

  async create(data: CreateRequestForm): Promise<MaintenanceRequest> {
    const response = await api.post<ApiResponse<MaintenanceRequest>>('/requests', data);
    return response.data.data;
  },

  async update(id: string, data: Partial<CreateRequestForm>): Promise<MaintenanceRequest> {
    const response = await api.patch<ApiResponse<MaintenanceRequest>>(`/requests/${id}`, data);
    return response.data.data;
  },

  async stop(id: string, data: StopRequestForm): Promise<MaintenanceRequest> {
    const response = await api.patch<ApiResponse<MaintenanceRequest>>(
      `/requests/${id}/stop`,
      data
    );
    return response.data.data;
  },

  async addNote(id: string, data: AddNoteForm): Promise<MaintenanceRequest> {
    const response = await api.patch<ApiResponse<MaintenanceRequest>>(
      `/requests/${id}/note`,
      data
    );
    return response.data.data;
  },

  async addHealthSafetyNote(id: string, data: AddHealthSafetyNoteForm): Promise<MaintenanceRequest> {
    const response = await api.patch<ApiResponse<MaintenanceRequest>>(
      `/requests/${id}/health-safety-note`,
      data
    );
    return response.data.data;
  },

  async complete(id: string): Promise<MaintenanceRequest> {
    const response = await api.patch<ApiResponse<MaintenanceRequest>>(`/requests/${id}/complete`);
    return response.data.data;
  },

  async softDelete(id: string): Promise<void> {
    await api.delete(`/requests/${id}`);
  },

  async hardDelete(id: string): Promise<void> {
    await api.delete(`/requests/${id}/hard`);
  },

  async restore(id: string): Promise<MaintenanceRequest> {
    const response = await api.post<ApiResponse<MaintenanceRequest>>(`/requests/${id}/restore`);
    return response.data.data;
  },

  async getDeleted(filters?: RequestFilters): Promise<RequestsResponse> {
    const response = await api.get<ApiResponse<MaintenanceRequest[]> & { meta: PaginationMeta }>(
      '/requests/trash',
      { params: filters }
    );
    return { data: response.data.data, meta: response.data.meta! };
  },
};




