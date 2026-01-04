import { api } from './api';
import { ApiResponse, Notification } from '@/types';

export const notificationsService = {
  async getAll(limit: number = 50): Promise<Notification[]> {
    const response = await api.get<ApiResponse<Notification[]>>('/notifications', {
      params: { limit },
    });
    return response.data.data;
  },
};








