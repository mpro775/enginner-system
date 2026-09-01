import { create } from "zustand";
import { Notification } from "@/types";
import { notificationsService } from "@/services/notifications";

interface NotificationWithRead extends Notification {
  id: string;
  read: boolean;
}

interface NotificationsState {
  notifications: NotificationWithRead[];
  unreadCount: number;
  isLoading: boolean;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  fetchNotifications: (limit?: number) => Promise<void>;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  addNotification: (notification) =>
    set((state) => {
      const key = `${notification.timestamp}-${notification.type}`;
      const exists = state.notifications.some(
        (n) => n.id === key || (n.timestamp === notification.timestamp && n.type === notification.type)
      );
      if (exists) {
        return state;
      }

      const newNotification: NotificationWithRead = {
        ...notification,
        id: key,
        read: false,
      };
      return {
        notifications: [newNotification, ...state.notifications].slice(0, 50),
        unreadCount: state.unreadCount + 1,
      };
    }),

  markAsRead: (id) =>
    set((state) => {
      const notification = state.notifications.find((n) => n.id === id);
      if (notification && !notification.read) {
        return {
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        };
      }
      return state;
    }),

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  clearNotifications: () => set({ notifications: [], unreadCount: 0, isLoading: false }),

  fetchNotifications: async (limit = 50) => {
    set({ isLoading: true });
    try {
      const serverNotifications = await notificationsService.getAll(limit);

      set((state) => {
        const readKeys = new Set(
          state.notifications
            .filter((n) => n.read)
            .map((n) => n.id || `${n.timestamp}-${n.type}`)
        );

        const currentNotifications: NotificationWithRead[] = serverNotifications.map(
          (notification) => {
            const key = `${notification.timestamp}-${notification.type}`;
            return {
              ...notification,
              id: key,
              read: readKeys.has(key),
            };
          }
        );

        const sortedNotifications = currentNotifications
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 50);

        const unreadCount = sortedNotifications.filter((n) => !n.read).length;

        return {
          notifications: sortedNotifications,
          unreadCount,
          isLoading: false,
        };
      });
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      set({ isLoading: false });
    }
  },
}));
