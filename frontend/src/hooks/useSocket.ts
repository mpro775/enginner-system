import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth';
import { useNotificationsStore } from '@/store/notifications';
import { useToast } from '@/hooks/use-toast';
import { Notification } from '@/types';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { accessToken, isAuthenticated } = useAuthStore();
  const { addNotification } = useNotificationsStore();
  const { toast } = useToast();

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    // Avoid creating duplicate connections (handles StrictMode)
    if (socketRef.current?.connected) {
      return;
    }

    // Use environment variable for socket URL, fallback to relative path for development
    const socketBaseUrl = import.meta.env.VITE_SOCKET_URL || '';
    const socketPath = socketBaseUrl ? `${socketBaseUrl}/notifications` : '/notifications';
    
    const socket = io(socketPath, {
      auth: { token: accessToken },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected');
    });

    socket.on('notification', (notification: Notification) => {
      addNotification(notification);
      
      // Show toast notification
      const getNotificationVariant = (type: string): "default" | "info" | "success" | "destructive" => {
        switch (type) {
          case "request:created":
            return "info";
          case "request:completed":
            return "success";
          case "request:stopped":
            return "destructive";
          case "request:updated":
            return "default";
          default:
            return "default";
        }
      };

      const getNotificationTitle = (type: string): string => {
        switch (type) {
          case "request:created":
            return "طلب صيانة جديد";
          case "request:completed":
            return "اكتمل الطلب";
          case "request:stopped":
            return "تم إيقاف الطلب";
          case "request:updated":
            return "تم تحديث الطلب";
          default:
            return "إشعار جديد";
        }
      };

      toast({
        title: getNotificationTitle(notification.type),
        description: notification.message,
        variant: getNotificationVariant(notification.type),
        duration: 5000,
      });
    });

    socket.on('disconnect', (reason) => {
      // Only log if it's not a client-initiated disconnect
      if (reason !== 'io client disconnect') {
        console.log('Socket disconnected:', reason);
      }
    });

    socket.on('connect_error', (error) => {
      // Only log actual connection errors, not cleanup-related ones
      if (socket.active) {
        console.error('Socket connection error:', error.message);
      }
    });

    return () => {
      // Close the socket cleanly on unmount
      socket.off('connect');
      socket.off('notification');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.close();
    };
  }, [isAuthenticated, accessToken, addNotification, toast]);

  return socketRef.current;
}



