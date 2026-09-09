import { ApiResponse, Notification } from "@/types";
import { api } from "./api";

export type NotificationStatus = "unread" | "read" | "all";

export const notificationsService = {
  async getAll(
    limit = 20,
    status: NotificationStatus = "unread",
  ): Promise<Notification[]> {
    const response = await api.get<ApiResponse<Notification[]>>(
      "/notifications",
      {
        params: { limit, status },
      },
    );
    return response.data.data;
  },

  async getUnreadCount(): Promise<number> {
    const response = await api.get<ApiResponse<{ count: number }>>(
      "/notifications/unread-count",
    );
    return response.data.data.count;
  },

  async markAsRead(id: string): Promise<Notification> {
    const response = await api.patch<ApiResponse<Notification>>(
      `/notifications/${id}/read`,
    );
    return response.data.data;
  },

  async markAllAsRead(): Promise<number> {
    const response = await api.patch<ApiResponse<{ updated: number }>>(
      "/notifications/read-all",
    );
    return response.data.data.updated;
  },
};
