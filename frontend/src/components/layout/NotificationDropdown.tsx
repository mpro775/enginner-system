import { Bell, CheckCircle2, Clock, XCircle, AlertCircle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useNotificationsStore } from "@/store/notifications";
import { useAuthStore } from "@/store/auth";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Role } from "@/types";

export function NotificationDropdown() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, fetchNotifications } =
    useNotificationsStore();
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      // Fetch notifications when dropdown is opened
      fetchNotifications();
    }
  };

  // Handle notification click - navigate to related page
  const handleNotificationClick = (notification: typeof notifications[0]) => {
    // Mark as read if not already read
    if (!notification.read) {
      markAsRead(notification.id);
    }

    // Determine navigation path based on notification type
    const notificationId = notification.data.id as string;
    
    if (notification.type.startsWith('request:')) {
      // Navigate to request details page
      if (notificationId) {
        navigate(`/app/requests/${notificationId}`);
        setIsOpen(false);
      }
    } else if (notification.type.startsWith('complaint:')) {
      // Navigate to complaint details page
      if (notificationId) {
        navigate(`/app/complaints/${notificationId}`);
        setIsOpen(false);
      }
    } else if (notification.type.startsWith('task:')) {
      // Navigate to scheduled tasks page based on user role
      // Admin and Consultant go to admin scheduled tasks page
      // Engineers go to their my-tasks page
      if (user?.role === Role.ADMIN || user?.role === Role.CONSULTANT) {
        navigate('/app/admin/scheduled-tasks');
      } else {
        navigate('/app/engineer/my-tasks');
      }
      setIsOpen(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "request:created":
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
      case "request:completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "request:stopped":
        return <XCircle className="h-4 w-4 text-orange-500" />;
      case "request:updated":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "complaint:created":
      case "complaint:resolved":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "task:created":
      case "task:overdue":
      case "task:pending":
        return <Calendar className="h-4 w-4 text-purple-500" />;
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getNotificationTypeLabel = (type: string) => {
    switch (type) {
      case "request:created":
        return "طلب جديد";
      case "request:completed":
        return "اكتمل الطلب";
      case "request:stopped":
        return "تم إيقاف الطلب";
      case "request:updated":
        return "تم تحديث الطلب";
      case "complaint:created":
        return "بلاغ جديد";
      case "complaint:resolved":
        return "تم حل البلاغ";
      case "task:created":
        return "مهمة جديدة";
      case "task:overdue":
        return "مهام متأخرة";
      case "task:pending":
        return "مهام معلقة";
      default:
        return "إشعار";
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 sm:h-10 sm:w-10 text-muted-foreground hover:text-foreground"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -left-0.5 sm:-top-1 sm:-left-1 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-destructive text-[9px] sm:text-[10px] text-destructive-foreground font-medium">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 sm:w-96 max-h-[500px] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold text-sm">الإشعارات</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={markAllAsRead}
            >
              تحديد الكل كمقروء
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            لا توجد إشعارات
          </div>
        ) : (
          <div className="py-1">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  "px-3 py-2 hover:bg-accent cursor-pointer transition-colors",
                  !notification.read && "bg-muted/50"
                )}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex-shrink-0">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        {getNotificationTypeLabel(notification.type)}
                      </p>
                      {!notification.read && (
                        <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">
                      {notification.message}
                    </p>
                    {notification.data.requestCode &&
                    typeof notification.data.requestCode === "string" ? (
                      <p className="text-xs text-muted-foreground font-mono">
                        #{notification.data.requestCode}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(notification.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2">
              <p className="text-xs text-center text-muted-foreground">
                إجمالي الإشعارات: {notifications.length}
              </p>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
