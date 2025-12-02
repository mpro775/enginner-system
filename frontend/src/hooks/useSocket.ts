import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth';
import { useNotificationsStore } from '@/store/notifications';
import { Notification } from '@/types';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { accessToken, isAuthenticated } = useAuthStore();
  const { addNotification } = useNotificationsStore();

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
  }, [isAuthenticated, accessToken, addNotification]);

  return socketRef.current;
}



