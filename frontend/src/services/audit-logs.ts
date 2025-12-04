import api from './api';
import { ApiResponse, AuditLog, PaginationMeta } from '@/types';

interface AuditLogsResponse {
  data: AuditLog[];
  meta: PaginationMeta;
}

interface AuditLogFilters {
  page?: number;
  limit?: number;
  userId?: string;
  action?: string;
  entity?: string;
  entityId?: string;
  fromDate?: string;
  toDate?: string;
}

export const auditLogsService = {
  async getAll(filters?: AuditLogFilters): Promise<AuditLogsResponse> {
    const response = await api.get<ApiResponse<AuditLog[]> & { meta: PaginationMeta }>(
      '/audit-logs',
      { params: filters }
    );
    return { data: response.data.data, meta: response.data.meta! };
  },

  async getByEntity(entity: string, entityId: string): Promise<AuditLog[]> {
    const response = await api.get<ApiResponse<AuditLog[]>>(
      `/audit-logs/entity/${entity}/${entityId}`
    );
    return response.data.data;
  },
};




