import { create } from "zustand";
import { notificationsService } from "@/services/notifications";
import { Notification } from "@/types";

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  pendingReadIds: string[];
  isMarkingAll: boolean;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => Promise<boolean>;
  markAllAsRead: () => Promise<boolean>;
  clearNotifications: () => void;
  fetchNotifications: (limit?: number) => Promise<void>;
}

const sortNewestFirst = (items: Notification[]) =>
  [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

let fetchSequence = 0;

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  pendingReadIds: [],
  isMarkingAll: false,

  addNotification: (notification) => {
    if (notification.readAt) return;
    set((state) => {
      if (state.notifications.some((item) => item.id === notification.id)) {
        return state;
      }
      return {
        notifications: [notification, ...state.notifications].slice(0, 20),
        unreadCount: state.unreadCount + 1,
      };
    });
  },

  markAsRead: async (id) => {
    const notification = get().notifications.find((item) => item.id === id);
    if (!notification || get().pendingReadIds.includes(id)) return true;
    set((state) => ({
      notifications: state.notifications.filter((item) => item.id !== id),
      unreadCount: Math.max(0, state.unreadCount - 1),
      pendingReadIds: [...state.pendingReadIds, id],
    }));
    try {
      await notificationsService.markAsRead(id);
      set((state) => ({
        pendingReadIds: state.pendingReadIds.filter((item) => item !== id),
      }));
      return true;
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      set((state) => ({
        notifications: state.notifications.some((item) => item.id === id)
          ? state.notifications
          : sortNewestFirst([notification, ...state.notifications]).slice(
              0,
              20,
            ),
        unreadCount: state.unreadCount + 1,
        pendingReadIds: state.pendingReadIds.filter((item) => item !== id),
      }));
      return false;
    }
  },

  markAllAsRead: async () => {
    if (get().isMarkingAll || get().notifications.length === 0) return true;
    const previousNotifications = get().notifications;
    const previousUnreadCount = get().unreadCount;
    set({ notifications: [], unreadCount: 0, isMarkingAll: true });
    try {
      await notificationsService.markAllAsRead();
      set({
        notifications: [],
        unreadCount: 0,
        isMarkingAll: false,
        pendingReadIds: [],
      });
      await get().fetchNotifications();
      return true;
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
      set((state) => {
        const byId = new Map(
          [...previousNotifications, ...state.notifications].map((item) => [
            item.id,
            item,
          ]),
        );
        return {
          notifications: sortNewestFirst(Array.from(byId.values())).slice(
            0,
            20,
          ),
          unreadCount: previousUnreadCount + state.unreadCount,
          isMarkingAll: false,
        };
      });
      return false;
    }
  },

  clearNotifications: () =>
    set({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      pendingReadIds: [],
      isMarkingAll: false,
    }),

  fetchNotifications: async (limit = 20) => {
    const requestSequence = ++fetchSequence;
    const notificationIdsAtStart = new Set(
      get().notifications.map((notification) => notification.id),
    );
    set({ isLoading: true });
    try {
      const [serverNotifications, unreadCount] = await Promise.all([
        notificationsService.getAll(limit, "unread"),
        notificationsService.getUnreadCount(),
      ]);
      set((state) => {
        if (requestSequence !== fetchSequence) return state;
        if (state.isMarkingAll) return { isLoading: false };
        const pending = new Set(state.pendingReadIds);
        const byId = new Map<string, Notification>();
        const websocketArrivals = state.notifications.filter(
          (notification) => !notificationIdsAtStart.has(notification.id),
        );
        for (const notification of [
          ...serverNotifications,
          ...websocketArrivals,
        ]) {
          if (!notification.readAt && !pending.has(notification.id)) {
            byId.set(notification.id, notification);
          }
        }
        return {
          notifications: sortNewestFirst(Array.from(byId.values())).slice(
            0,
            limit,
          ),
          unreadCount: Math.max(
            Math.max(0, unreadCount - pending.size),
            byId.size,
          ),
          isLoading: false,
        };
      });
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      if (requestSequence === fetchSequence) set({ isLoading: false });
    }
  },
}));
