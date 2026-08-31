import api from './api';
import {
  ApiResponse,
  Complaint,
  CreateComplaintForm,
  PaginationMeta,
  ComplaintStatus,
  ComplaintReferenceData,
  CreateComplaintRequestForm,
  Floor,
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
  departmentId?: string;
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

  async assign(id: string, engineerId: string): Promise<Complaint> {
    const response = await api.patch<ApiResponse<Complaint>>(
      `/complaints/${id}/assign`,
      { engineerId }
    );
    return response.data.data;
  },

  async getPublicReferenceData(): Promise<ComplaintReferenceData> {
    const response = await api.get<ApiResponse<ComplaintReferenceData>>(
      '/public/complaints/reference-data',
    );
    return response.data.data;
  },

  async getPublicFloors(locationId: string): Promise<Array<Pick<Floor, 'id' | 'name'>>> {
    const response = await api.get<ApiResponse<Array<Pick<Floor, 'id' | 'name'>>>>(
      '/public/complaints/floors',
      { params: { locationId } },
    );
    return response.data.data;
  },

  async addReviewNote(id: string, body: string): Promise<Complaint> {
    const response = await api.post<ApiResponse<Complaint>>(
      `/complaints/${id}/review-notes`,
      { body },
    );
    return response.data.data;
  },

  async transferDepartment(id: string, toDepartmentId: string, reason?: string): Promise<Complaint> {
    const response = await api.patch<ApiResponse<Complaint>>(
      `/complaints/${id}/transfer-department`,
      { toDepartmentId, reason },
    );
    return response.data.data;
  },

  async createMaintenanceRequest(
    id: string,
    data: CreateComplaintRequestForm,
  ): Promise<Complaint> {
    const response = await api.post<ApiResponse<Complaint>>(
      `/complaints/${id}/create-maintenance-request`,
      data,
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

  async softDelete(id: string): Promise<void> {
    await api.delete(`/complaints/${id}`);
  },

  async hardDelete(id: string): Promise<void> {
    await api.delete(`/complaints/${id}/hard`);
  },

  async restore(id: string): Promise<Complaint> {
    const response = await api.post<ApiResponse<Complaint>>(`/complaints/${id}/restore`);
    return response.data.data;
  },

  async getDeleted(filters?: ComplaintFilters): Promise<ComplaintsResponse> {
    const response = await api.get<ApiResponse<Complaint[]> & { meta: PaginationMeta }>(
      '/complaints/trash',
      { params: filters }
    );
    return { data: response.data.data, meta: response.data.meta! };
  },
};








