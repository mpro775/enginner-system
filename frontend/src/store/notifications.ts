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
      // Check if notification already exists (by timestamp and type)
      const exists = state.notifications.some(
        (n) => n.timestamp === notification.timestamp && n.type === notification.type
      );
      if (exists) {
        return state;
      }

      const newNotification: NotificationWithRead = {
        ...notification,
        id: `${notification.timestamp}-${Math.random()}`,
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

  clearNotifications: () => set({ notifications: [], unreadCount: 0 }),

  fetchNotifications: async (limit = 50) => {
    set({ isLoading: true });
    try {
      const notifications = await notificationsService.getAll(limit);
      
      // Convert to NotificationWithRead format
      const notificationsWithRead: NotificationWithRead[] = notifications.map((notification) => ({
        ...notification,
        id: `${notification.timestamp}-${notification.type}-${Math.random()}`,
        read: false, // All fetched notifications are considered unread initially
      }));

      // Merge with existing notifications, avoiding duplicates
      set((state) => {
        const existingIds = new Set(state.notifications.map((n) => `${n.timestamp}-${n.type}`));
        const newNotifications = notificationsWithRead.filter(
          (n) => !existingIds.has(`${n.timestamp}-${n.type}`)
        );

        // Combine and sort by timestamp
        const allNotifications = [...newNotifications, ...state.notifications]
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 50);

        // Calculate unread count
        const unreadCount = allNotifications.filter((n) => !n.read).length;

        return {
          notifications: allNotifications,
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
