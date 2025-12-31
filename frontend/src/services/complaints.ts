import api from './api';
import {
  ApiResponse,
  Complaint,
  CreateComplaintForm,
  PaginationMeta,
  ComplaintStatus,
} from '@/types';

interface ComplaintsResponse {
  data: Complaint[];
  meta: PaginationMeta;
}

interface ComplaintFilters {
  page?: number;
  limit?: number;
  status?: ComplaintStatus;
  search?: string;
  assignedEngineerId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const complaintsService = {
  async getAll(filters?: ComplaintFilters): Promise<ComplaintsResponse> {
    const response = await api.get<ApiResponse<Complaint[]> & { meta: PaginationMeta }>(
      '/complaints',
      { params: filters }
    );
    return { data: response.data.data, meta: response.data.meta! };
  },

  async getById(id: string): Promise<Complaint> {
    const response = await api.get<ApiResponse<Complaint>>(`/complaints/${id}`);
    return response.data.data;
  },

  async create(data: CreateComplaintForm): Promise<Complaint> {
    const response = await api.post<ApiResponse<Complaint>>('/complaints', data);
    return response.data.data;
  },

  async update(id: string, data: Partial<CreateComplaintForm>): Promise<Complaint> {
    const response = await api.patch<ApiResponse<Complaint>>(`/complaints/${id}`, data);
    return response.data.data;
  },

  async assign(id: string, engineerId: string): Promise<Complaint> {
    const response = await api.patch<ApiResponse<Complaint>>(
      `/complaints/${id}/assign`,
      { engineerId }
    );
    return response.data.data;
  },

  async linkMaintenanceRequest(id: string, maintenanceRequestId: string): Promise<Complaint> {
    const response = await api.patch<ApiResponse<Complaint>>(
      `/complaints/${id}/link-request`,
      { maintenanceRequestId }
    );
    return response.data.data;
  },

  async changeStatus(id: string, status: ComplaintStatus): Promise<Complaint> {
    const response = await api.patch<ApiResponse<Complaint>>(
      `/complaints/${id}/status`,
      { status }
    );
    return response.data.data;
  },
};






