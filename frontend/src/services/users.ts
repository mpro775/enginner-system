import api from './api';
import { ApiResponse, User, CreateUserForm, PaginationMeta } from '@/types';

interface UsersResponse {
  data: User[];
  meta: PaginationMeta;
}

interface UserFilters {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  isActive?: boolean;
}

export const usersService = {
  async getAll(filters?: UserFilters): Promise<UsersResponse> {
    const response = await api.get<ApiResponse<User[]> & { meta: PaginationMeta }>('/users', {
      params: filters,
    });
    return { data: response.data.data, meta: response.data.meta! };
  },

  async getById(id: string): Promise<User> {
    const response = await api.get<ApiResponse<User>>(`/users/${id}`);
    return response.data.data;
  },

  async create(data: CreateUserForm): Promise<User> {
    const response = await api.post<ApiResponse<User>>('/users', data);
    return response.data.data;
  },

  async update(id: string, data: Partial<CreateUserForm>): Promise<User> {
    const response = await api.patch<ApiResponse<User>>(`/users/${id}`, data);
    return response.data.data;
  },

  async toggleStatus(id: string): Promise<User> {
    const response = await api.patch<ApiResponse<User>>(`/users/${id}/toggle-status`);
    return response.data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/users/${id}`);
  },

  async getEngineers(): Promise<User[]> {
    const response = await api.get<ApiResponse<User[]>>('/users/engineers');
    return response.data.data;
  },

  async getConsultants(): Promise<User[]> {
    const response = await api.get<ApiResponse<User[]>>('/users/consultants');
    return response.data.data;
  },
};





