import { create } from 'zustand';
import { Notification } from '@/types';

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Notification) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, 50),
      unreadCount: state.unreadCount + 1,
    })),

  markAllAsRead: () => set({ unreadCount: 0 }),

  clearNotifications: () => set({ notifications: [], unreadCount: 0 }),
}));




